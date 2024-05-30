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
	const frameNumber = Math.round(Math.log(duration)) * 2;
	console.log("frameNumber", frameNumber, duration);
 	let command = `ffmpeg -i ${filePath} -vf "thumbnail" -r 1/3 -q:v 8 -vframes ${frameNumber} ${folder}/frame-%02d.png`;
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
				image_url: { url: `data:image/png;base64,${base64}`, detail: "high" }
			})
		};
		
		const payload = {
			"model": "gpt-4o",
			"temperature": 0.1,
			"messages": [
				{
					role: "system",
					content: `Hi, I'm a bot that can help you identify a relevant frame of good quality that doesn't have to be a transition between 2 scenes and without double exposure.
					I respond with a JSON object containing the number of the most relevant frame, and a short description of this image and its quality. Example: {“frame”: 3, “explanation”: “This frame is the most relevant because it shows a key moment in the program and contains no double exposure”}.
					Never select an image with composite or double exposure.
					I need to choose an image with a clear scene.
					It's not mandatory, but I prefer to avoid images from the credits of the program.`
				},
				  { "role": "user",
				   "content": [
						{
							"type": "text", 
							"text": `gimme the best frame from these ones ?`
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
		}).then(response => {
			console.log("response", response)
			return response.json()
		}).then(data =>{ 
			const message = data.choices[0].message;
			console.log("data from gpt = ",message)
			const jsonContent = message?.content.match(/{.*?}/s)[0];
			console.log("jsonContent", jsonContent)
			const content = JSON.parse(jsonContent) || {};
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

