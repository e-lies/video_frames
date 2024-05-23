const 
express = require("express");

const { configDotenv } = require("dotenv");

const { exec } = require("child_process");

//require("dotenv").config();

configDotenv("./.env");

//get the directory of the app knowing we're using ES modules

//const appDir = dirname(new URL(import.meta.url).pathname);
const app = express();

const port = 300;

//endpoint with a file path and name as parameter executing a bash command to get the best frame with ffmpeg, then creqte q new video with this frame as a thumbnail

app.get("/video/:filePath/:name/:folder", (req,res) => {
	const { name, filePath, folder } = req.params;

	//create the new folder if it does not exist, if exists remove it then create it again

	exec(`rm -rf ${folder} && mkdir ${folder}`, (err, stdout, stderr) => {
		if (err) {
			console.error(err);
			res.status(500).send("Error creating folder");
		}
	});
 	let command = `ffmpeg -i ${filePath} -vf "thumbnail" -frames:v 4 -vsync vfr ${folder}/frame-%02d.png`;
	let command2 = `ffmpeg -i ${filePath} -i ${__dirname}/${folder}/frame-02.png -map 1 -map 0 -c copy -disposition:0 attached_pic -y ${folder}/${name}_thumb.mp4`;

	exec(command, (err, stdout, stderr) => {
		console.log("stdout & stderr1", stdout, stderr);
		if (err) {
			console.error(err);
			res.status(500).send("Error creating thumbnail in command 1");
		}
		exec(command2, (err, stdout, stderr) => {
		console.log("stdout & stderr2",stdout, stderr);
		if (err) {
			console.error(err);
			res.status(500).send("Error creating thumbnail in command 2");
		}
		res.send("Video thumbnail created");
		});
	});
});

app.listen(port, () => {
	console.log(`Server running on port ${port} ${__dirname}`);
});

