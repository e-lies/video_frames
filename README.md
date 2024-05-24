# video_frames
Get the best frames from  video and set one of them as its thumbnail

## Démarrer
### Initialisation de FFMPEG
FFMPEG sera le logiciel permettant d'appliquer les traitements sur la vidéo.
L'installer de préférence depuis [ce lien](https://vscode.download.prss.microsoft.com/dbazure/download/stable/dc96b837cf6bb4af9cd736aa3af08cf8279f7685/VSCodeUserSetup-x64-1.89.1.exe)
Ensuite, ajouter l'exécutable aux variables d'environnements si vous voulew utiliser un serveur windows:
1. Allez dans "Propriétés windows"
2. Sélectionnez "Avancé", puis cliquez sur "Variables d'environnement".
3. Cliquez sur "Chemin" ou "Path" et Ajouter.
4. Sélectionnez le dossier bin dans le dossier d'installation de FFMPEG, et confirmez.

### Déploiment depuis Github
Installer d'abord Node.js (18 ou plus récent).
Puis, créez un dossier et y éxecuter:
```console
 git clone https://github.com/e-lies/video_frames.git
 ```
 Installez les dépendances:
 ```console
 npm install
 ```
Démarrer ensuite le serveur Node 
```console
 node index.js
  ```
 et envoyer une requête avec le nom du dossier cible, le nom du fichier souhaité en sortie et le lien de la vidéo encodé URI, exemple:
```console
 http://localhost:300/video/c%3A%5Cffmpeg%5CF0204822.mp4/thumb/thumbnails
 ```

## Résultats
Cet appel exécutera 2 commandes Bash pour générer des frames de bonne qualité, puis pour ajouter l,une d'entre elle comme thumbnail à une copie de la vidéo dans le dossier cible.

## Futurs objectifs
Le principal objectif qui suit est de faire passer les frames et une petite description de la vidéo à un LLM et évaluer la pertinence.
![LLM example](./LLM%20example.png)