const fs = require('fs-extra');
const program = require('commander');
const la = require('@uts-eresearch/provision-labarchives');
const {LaToRoCrate} = require('./index');

let outDir = '';

program
  .version("0.1.0")
  .description(
    "Exports RO-Crate data packages from LabArchives - uses the "
  )
  .option("-u --username [username]", "Email address used for LabArchives login")
  .option("-t --password-token [token]", "LabArchives 'Password Token for External applications' via the menu that shows your name at top right of the webiste under 'LA App Authentication")
  .option("-l, --list-notebooks", "List notebooks")
  .option("-i --user-id  [file]", "Path to a file containing a LabArchives user ID secret")
  .option("-n, --notebook-id [nbid]", "ID of the notebook to export. Get a list via -l")
  .option("-c --cratescript [crate]", "Optional URL to the RO-Crate rendering script (there is a default)")
  .option("-m --metadata [ro-crate-metadata.jsonld]", "Optional RO-Crate metadata file to use as a template for the root dataset and contextual entities (eg people)")
  .arguments("<dir>")
  .action((dir) => {
    outDir = dir
  });
program.parse(process.argv);

//User login
const nbid = program.notebookId;
const username = program.username;
const token = program.passwordToken;
const uidFile = program.userId;
const cratescript = program.cratescript;
const metadataTemplate = program.metadata;

const keyPath = './key.json';
let key = {};

async function writeUserId(key, username, token) {
  response = await la.accessInfo(key, username, token);
  var uid = response.users.id;
  console.log("Writing uid file")
  fs.writeFileSync(uidFile, uid);
}

(async function () {
    try {
      var uid;
      if (fs.existsSync(keyPath)) {
        const keyFile = fs.readFileSync(keyPath, 'utf8');
        try {
          key = JSON.parse(keyFile);
        } catch (error) {
          console.log('key not found please make sure key.json is complete');
          process.exit(-1);
        }
      } else {
        console.log('please include key.json file');
        process.exit(-1);
      }
      if (username && token && uidFile) {
        await writeUserId(key, username, token);
      } else if (fs.existsSync(uidFile)) {
        console.log("Reading uid file")
        uid = fs.readFileSync(uidFile, 'utf8');
        if (nbid) {
          const laToRoCrate = new LaToRoCrate(key, outDir, "ro-crate-metadata.jsonld", true);
          const pageMetaDescription = "JSON Metadata from the LabArchives API as retrieved";
          //TODO: Ability to describe each page of the notebook
          //TODO: Create an exportNotebook (async)
          const nb = await la.getNotebookInfo(key, uid, nbid);
          const rootDatasetName = nb.notebooks.notebook["name"];
          //This next line is in case you want to use another name to
          // store it in your system like an ID
          const outputDirectoryName = rootDatasetName.toLowerCase();
          //console.log(util.inspect(nb, false, null));
          await laToRoCrate.exportNotebookSync(uid, nbid, rootDatasetName, outputDirectoryName, cratescript, metadataTemplate, pageMetaDescription);
        } else {
          response = await la.userInfoViaId(key, uid, token);
          for (let notebook of response.users.notebooks.notebook) {
            console.log(notebook.id, notebook.name)
          }
        }
      } else {
        console.log('provide username (-u) and token  (-t) and path to secret file to store the user id (-i)');
      }
    } catch (e) {
      console.log('Error Exporting Notebook:')
      console.log(e);
    }
  }
)();


