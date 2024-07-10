const express = require("express");

const { configDotenv } = require("dotenv");

const { exec, execSync } = require("child_process");

const fs = require("fs");
const { type } = require("os");
const https = require("https");
const path = require("path");

//require("dotenv").config();

configDotenv("./.env");

const basePath = "Q:\\\\FichierMasstech\\\\LOUISE_RESTORE\\\\"
//const basePath = "C:\\\\projets_ai\\\\";
//get the directory of the app knowing we're using ES modules

//const appDir = dirname(new URL(import.meta.url).pathname);
const app = express();

const port = 3003;

//read the body of the request
app.use(express.json());


app.post("/video", async (req,res) => {
	let { name, filePath, folder } = req.body;
	folder = `Q:\\\\ExportPlateformes\\\\__NewThums_NePasEffacer_Fred\\\\Thumb_${folder}`;
	//folder = `C:\\\\projets_ai\\\\Thumb_${folder}`;
	//create the new folder if it does not exist, if exists remove it then create it again

	console.log("video folder = ",`${basePath}${filePath}`)

	if (fs.existsSync(folder)) {
		fs.rmSync(folder, { recursive: true });
	}
	fs.mkdirSync(folder);
	
	let rawDuration = execSync(
		`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${basePath}${filePath}`);
		
	let duration = parseInt(rawDuration.toString());
	const frameNumber = Math.round(Math.log(duration)) * 4;

	let command0 = `ffmpeg -i ${basePath}${filePath} -vf bwdif=mode=send_field:parity=auto:deint=all -c:v mpeg2video -b:v 50M -minrate 50M -maxrate 50M -bufsize 2M -pix_fmt yuv422p -c:a copy ${folder}/${name}_deinterlaced.mxf`;


	execSync(command0, (err, stdout, stderr) => {
		if (err) {
			console.error(err);
			res.status(500).send("Error deinterlacing the video");
		}
		console.log("deinterlacing done successfully")
	})

	let step = Math.round(Math.log(duration));
 	let command = `ffmpeg -i ${folder}/${name}_deinterlaced.mxf -vf "thumbnail" -r 1/${step} -q:v 4 -vframes ${frameNumber} ${folder}/frame-%02d.jpg`;
	let command2 = `ffmpeg -i ${basePath}${filePath} -i ${folder}/frame-01.jpg -map 1 -map 0 -c copy -disposition:0 attached_pic -y ${folder}/${name}_thumb.mxf`;

	exec(command, (err, stdout, stderr) => {
		if (err) {
			console.error(err);
			res.status(500).send("Error creating thumbnail in command 1");
		}
		//load the images as base64
		const fs = require('fs');
		let framesBase64 = [];
		for (let i = 1; i <= frameNumber; i++) {
			let base64 = fs.readFileSync(`${folder}/frame-${i > 9 ? i : "0"+i}.jpg`, { encoding: 'base64' });
			framesBase64.push({
				type: "image_url", 
				image_url: { url: `data:image/jpeg;base64,${base64}`, detail: "low" }
			})
		};
		const payload1 = {
			"model": "gpt-4o",
			"temperature": 0.2,
			"messages": [
				{
					role: "system",
					type: "text",
					content: `Tu es un bot qui a pour objectif de filtrer une série d'images issues d'une vidéo pour ne garder que les meilleures.
							Les critères d'élimination d'une image sont:
							- Si l'image est floue, elle doit être éliminée. 
							- Si l'image contient une double exposition, elle doit être éliminée.
							- Si l'image a trop de peu de contraste, elle doit être éliminée.
							- Si une image contient beaucoup de texte, elle doit être éliminée.`
				},
				  { "role": "user",
				   "content": [
						...framesBase64,
						{
							"type": "text", 
							"text": `Je voudrai la liste des frames que tu as choisi de garder dans un objet JSON, avec une clé "frames" qui sera un tableau avec leur numéro seulement, et une autre clé "explication" qui sera un tableau avec une explication pour chaque frame,
							 exemple { "frames": [5, 7, 9], explication": "Les autres images sont floues ou bien sont des double expositions entre 2 scènes" }`
						}
					] 
				}
			]
		}
	
		fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
			},
			body: JSON.stringify(payload1)
		}).then(response => {
			return response.json()
		}).then(data =>{ 
			try{
				const message = data.choices[0].message;
				const jsonContent = message?.content.match(/{.*?}/s)[0];
				const content = JSON.parse(jsonContent) || {};
				const selectedFrames = content?.frames;
				const framesBase642 = framesBase64.filter((frame, i) => selectedFrames.includes(parseInt(i)+1))
				const payload2 = {
					"model": "gpt-4o",
					"temperature": 0.7,
					"messages": [
						{
							role: "system",
							type: "text",
							content: `Je suis un bot qui a pour objectif de sélectionner la meilleure image parmi une suite de frames qui ont été extraites d'une vidéo. 
							Je dois choisir la frame qui représente le mieux le contenu du programme TV dont sont issues les images.
							Et je dois choisir une image qui est compréhensible et qui est bien cadrée, en évitant les frames avec des expressions faciales transitoires qui peuvent sembler étranges ou peu flatteuses.
							Éviter au maximum les frames issue du générique de début ou de fin de programme.`
						},
						{ "role": "user",
						"content": [
							...framesBase642, 
							{
							"type": "text", 
							"text": `Je voudrai la meilleure frame, et récupérer le résultat sous la forme un objet JSON contenant le numéro de la frame et une explication de ton choix, exemple { "frame": 5, "explication": "J'ai choisi cette image car elle est bien cadrée et représente une scène claire qui représente bien le contenu du programme" }`
						}
							] 
						}
					]
				}
				fs.unlink(`${folder}/${name}_deinterlaced.mxf`, (err)=>{
					if(err){
						return console.log("failed to remove the altered video")
					}
					console.log("Altered video deleted sucessfully")
				})		
				fetch('https://api.openai.com/v1/chat/completions', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
					},
					body: JSON.stringify(payload2)
				}).then(response => {
					return response.json()
				}).then(data =>{
					const message = data.choices[0].message;
						const jsonContent = message?.content.match(/{.*?}/s)[0];
					const content = JSON.parse(jsonContent) || {};
					let i = content?.frame;
					let selectedFrame = selectedFrames[i-1];
					//exec(`start ${__dirname}/${folder}/frame-${selectedFrame > 9 ? selectedFrame : "0"+selectedFrame}.jpg`)
					
					//recreate the selected frame in a new file in a folder named "selectedFrame" after creating the folder
					fs.mkdirSync(`${folder}/selectedFrame`);
					fs.writeFileSync(`${folder}/selectedFrame/selectedFrame.txt`, `La frame seléctionnée est la ${selectedFrame}. \n ${content?.explication}`); 
					fs.copyFileSync(`${ folder }/frame-${selectedFrame > 9 ? selectedFrame : "0"+selectedFrame}.jpg`, `${ folder }/selectedFrame/frame-${selectedFrame > 9 ? selectedFrame : "0"+selectedFrame}.jpg`);
					res.status(200).send(data);
				}).catch(err => {
					console.error("error = ",err);
					res.status(500).send("Error with GPT-4o in second request");
				}); 

			} catch (err) {
				console.error("err = ", err);
				res.status(500).send("Error with GPT-4o in the code");
			}
		}).catch(err => {
			fs.unlink(`${folder}/${name}_deinterlaced.mxf`, (err)=>{
				if(err){
					return console.log("failed to remove the altered video")
				}
				console.log("Altered video deleted sucessfully")
			})
			console.error(err);
			res.status(500).send("Error with GPT-4o in first request");
		});

		/*exec(command2, (err, stdout, stderr) => {
		if (err) {
			console.error(err);
			res.status(500).send("Error creating thumbnail in command 2");
		}
		res.send("Video thumbnail created");
		}); */
	});
});

const options = {
	key: fs.readFileSync(path.join(__dirname, "localhost-key.pem")),
	cert: fs.readFileSync(path.join(__dirname, "localhost.pem")),
};
  
  // Create HTTPS server
const server = https.createServer(options, app);

app.listen(port, () => {
	console.log(`Server running on port ${port} ${__dirname}`);
});
