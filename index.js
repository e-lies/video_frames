const 
express = require("express");

const { configDotenv } = require("dotenv");

const { exec, execSync } = require("child_process");

const fs = require("fs");

//require("dotenv").config();

configDotenv("./.env");

//get the directory of the app knowing we're using ES modules

//const appDir = dirname(new URL(import.meta.url).pathname);
const app = express();

const port = 300;

//read the body of the request
app.use(express.json());


app.post("/video", async (req,res) => {
	console.log("body", req.body);
	let { name, filePath, folder } = req.body;
	folder = `thumbnails/Thumb_${folder}`;

	//create the new folder if it does not exist, if exists remove it then create it again
	if (fs.existsSync(folder)) {
		fs.rmSync(folder, { recursive: true });
	}
	fs.mkdirSync(folder);
	
	let rawDuration = execSync(
		`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${filePath}`);
		
	let duration = parseInt(rawDuration.toString());
	const frameNumber = Math.round(Math.log(duration)) * 4;
	console.log("frameNumber", frameNumber, duration);
 	let command = `ffmpeg -i ${filePath} -vf "thumbnail" -r 1/3 -q:v 1 -vframes ${frameNumber} ${folder}/frame-%02d.png`;
	let command2 = `ffmpeg -i ${filePath} -i ${__dirname}/${folder}/frame-01.png -map 1 -map 0 -c copy -disposition:0 attached_pic -y ${folder}/${name}_thumb.mxf`;

	exec(command, (err, stdout, stderr) => {
		console.log("stdout & stderr1", stdout);
		if (err) {
			console.error(err);
			res.status(500).send("Error creating thumbnail in command 1");
		}
		//load the images as base64
		const fs = require('fs');
		let framesBase64 = [];
		for (let i = 1; i <= frameNumber; i++) {
			let base64 = fs.readFileSync(`${folder}/frame-${i > 9 ? i : "0"+i}.png`, { encoding: 'base64' });
			framesBase64.push({
				type: "image_url", 
				image_url: { url: `data:image/png;base64,${base64}`, detail: "low" }
			})
		};
		
		const payload = {
			"model": "gpt-4o",
			"messages": [
				{
					"role": "system",
					"content": `Bonjour, je suis un bot qui peut vous aider à identifier une frame pertinente de très bonne qualité et qui donne une idée du conntenu de l'épisode:
					 _Je répond avec un objet JSON contenant le numéro de la frame la plus pertinente et une petite explication. Exemple: {frame: 3, explanation: 'Cette frame est la plus pertinente car elle montre un moment clé du programme'}.
					 `
				},
				  { "role": "user",
				   "content": [
						{
							"type": "text", 
							"text": `Voici une série de frames extraites d'une vidéo d'une emission, peux-tu me donner le numéro de la frame la plus pertinente ? sachant que:
							_La frame doit être une scène de l'émission.
					 _Elle doit être aussi nette que possible, sans flou ni artefacts.
					 _Elle ne doit pas être composite ou une double exposition.
					 _Elle ne doit pas faire partie du générique de début ou de fin de l'émission.
					 _Elle doit éviter au maximum de contenir des éléments de transition entre les scènes qui pourrait être flous.`
						},
						...framesBase64
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
			body: JSON.stringify(payload)
		}).then(response => response.json()).then(data =>{ 
			const message = data.choices[0].message;
			const jsonContent = message?.content.match(/{.*?}/s)[0];
			const content = JSON.parse(jsonContent) || {};
			console.log("jsonContent", content)
			let i = content?.frame;
			exec(`start ${__dirname}/${folder}/frame-${i > 9 ? i : "0"+i}.png`)
			// execute a bash command to create a text file with the text of the "content" variable
			fs.writeFileSync(`${folder}/selectedFrame.txt`, `La frame seléctionnée est la ${i}. \n ${content?.explanation}`);
			res.status(200).send(data);
		}).catch(err => {
			console.error(err);
			res.status(500).send("Error with GPT-4o");
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

app.listen(port, () => {
	console.log(`Server running on port ${port} ${__dirname}`);
});

