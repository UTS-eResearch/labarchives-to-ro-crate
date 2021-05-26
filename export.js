const fs = require('fs-extra');
const la = require('@uts-eresearch/provision-labarchives');
const path = require('path');
const ROCrate = require("ro-crate").ROCrate;
const Preview = require("ro-crate-html-js").Preview;
const HtmlFile = require("ro-crate-html-js").HtmlFile;
const crate = new ROCrate();
crate.index();
var rootDataset = crate.getRootDataset();
const program  = require('commander');

program
  .version("0.1.0")
  .description(
    "Exports RO-Crate data packages from LabArchives - uses the "
  )
  .option("-u --username [username]", "Email address used for LabArchives login")
  .option("-t --password-token [token]", "Lab Arvhives 'Password Token for External applications' via the menu that shows your name at top right of the webiste under 'LA App Authentication")
  .option("-l, --list-notebooks", "List notebooks")
  .option("-i --user-id  [file]", "Path to a file containing a LabArchives user ID secret")
  .option("-n, --notebook-id [nbid]", "ID of the notebook to export. Get a list via -l")
  .option("-c --cratescript [crate]", "Optional URL to the RO-Crate rendering script (there is a default)")
  .option("-m --metadata [ro-crate-metadata.jsonld]", "Optionl RO-Crate metadata file to use as a template for the root dataset and contextual entities (eg people)")
  .arguments("<dir>")
  .action((dir) => {outDir = dir})
  ;
var depth = 0;
program.parse(process.argv);
//User login
const nbid  = program.notebookId;
const uuidFile = program.uuidFile;
const username = program.username;
const token = program.passwordToken;
const uidFile = program.userId;
const cratescript = program.cratescript;
const metadataTemplate = program.metadata;

const keyPath = './key.json';
let key = {};

function addTextItem(page, text, entry, crate) {
    page.hasPart.push(
        {
            "@id": `#${entry.eid}`
        }

    );
    crate.getGraph().push({
        "@id": `#${entry.eid}`,
        "@type": ["Article"],
        "articleBody": text,
        "dateCreated": entry["created-at"]["_"],
        "contributor": entry["last-modified-by"],
        "version": entry["version"]["_"],
        "description": `${entry["last-modified-verb"]} by ${entry["last-modified-by"]} at ${entry["created-at"]["_"]}`
    });


}
var count= 0;

async function getPages(key, uid, nbid, parentId, dataset, dir, rootDir) {
    const tree = await la.getTree(key, uid, nbid, parentId);
    var levelNodes = tree["tree-tools"]["level-nodes"]['level-node']
    if (!Array.isArray(levelNodes)) {
        levelNodes = [levelNodes];
    }
    dataset.hasPart = [];
    for (let node of levelNodes) {
        if (!node) {break};
        var page = {};
        page.name = node["display-text"];
        var dirName = toDirName(page.name);
        // TODO IF EXISTS MAKE ANOTHER ONE!!!
        // NewDir is relative
        const newDir = path.join(dir, dirName);
        // dirPath is absolute
        const dirPath = path.join(rootDir, newDir)
        fs.mkdirSync(dirPath);
        dataset.hasPart.push({"@id": newDir});
        page["@id"] = newDir;
        page["@type"] = ["Dataset"];
        page.hasPart = [];
        crate.getGraph().push(page);
        if (node["is-page"]["_"] === 'true') {
            process.stdout.write(`Page: ${page.name} \r`)
            //console.log("Page:", page.name, "\r");
            //console.log(dataset);
            //console.log(rootDataset);   
            //console.log("CRATE", JSON.stringify(crate.getJson()));
            page.articleBody = "";
            page["@type"].push("Article"); 
                           
            const pageEntries = await la.getEntriesForPage(key, uid, nbid, node['tree-id']);
            page.text = [];
            //console.log(util.inspect(pageEntries, false, null));
            var entries = pageEntries["tree-tools"].entries.entry;
            // TODO - make entry dirs?
            if (entries) {
                if (!Array.isArray(entries)) {
                    entries = [entries];         
                }
                
                for (let entry of entries) {
                    // This is the ID to use for entries - will prepend # for ones that are not files
                    const entryUrl = path.join(newDir, entry.eid);
                    fs.mkdirpSync(path.join(rootDir, entryUrl));
                    // Write a copy of the JSON metafdata
                    apiFileName = `api${count++}.json`
                    jsonId = path.join(entryUrl, apiFileName);
                    const json = {"@id": jsonId};
                    json["@type"] = "File";
                    json.name = apiFileName;
                    json["description"] = "JSON Metadata from the LabArchives API as retrieved"
                    json.url = entry["entry-url"]
                    crate.getGraph().push(json);
                    page.hasPart.push({"@id": jsonId});
                    const jsonPath = path.join(rootDir, jsonId);
                    fs.writeFileSync(jsonPath, JSON.stringify(entry, null, 2));

                    //console.log("Setting outDir", outDir);
                    //console.log("Getting entry with ID:", entry.eid);
                    var text = "";
                    if (entry['part-type'] === "heading") {
                        text += `<h1>${entry["entry-data"]}</h1>`
                    } else if (entry["entry-data"] && !(entry["entry-data"]["$"] && entry["entry-data"]["$"]['nil']=== 'true')) {
                        // TODO Make separate pages w/ entries
                       text += entry["entry-data"]; 
                    } 
                    //const entry = await la.getEntry(key, uid, e.eid);
                    //console.log(util.inspect(entry, false, null));
                    
                    if (entry["part-type"] === "widget entry" && entry["snapshot"] === "snapshot_exists") {
                        //https://<baseurl>/api/entries/entry_snapshot?uid=285489257Ho's9^Lt4116011183268315271&eid=sdfjkshdfkjshdfkjhskdjfhskjdfh&<Call Authentication Parameters>
                        const filename = await la.getSnapshot(key, uid, entry.eid, path.join(rootDir, entryUrl));

                        const fileId = path.join(entryUrl, filename);
                        const file = {"@id": fileId};
                        // Absolute path to write file into
                        // Todo - move the file
                        file["@type"] = "File";
                        crate.getGraph().push(file);
                        page.hasPart.push({"@id": fileId}); 
                        text += `<figure><img style='width:50%' src='${fileId}' alt='Widget snapshot'><br/></figure>`;
                    }
                    
                    if (entry["part-type"] === "Attachment") {
                        // Make a directory for each file
                        // Absolute path
                        // Relative ID/path to file
                        const fileId = path.join(entryUrl, entry['attach-file-name']);
                        // Absolute path to write file into
                        const out = path.join(rootDir, fileId);
                    
                        const file = {"@id": fileId};
                        file["@type"] = "File";
                        crate.getGraph().push(file);
                        page.hasPart.push({"@id": fileId});
                        if (out.match(/\.(jpe?g|png)$/i)) {
                            //console.log(util.inspect(entry, false, null));
                            file.description = entry.caption;
                           text += `<figure><img style='width:50%' src='${fileId}' alt='${entry.caption}'><br/><figcation>${entry.caption}</figcation></figure>`;
                        }
                        if (out.match(/\.pdf$/i)) {
                             text += `<embed src="./${fileId}" type="application/pdf" width="60%" height="600px" />`;
                        }        
                        
                        text += `<p>⬇️🏷️ Download: <a href='${fileId}'>${entry['attach-file-name']}</a></p>\n`; 

                        //Get the file
                        await la.getEntryAttachment(key, uid, entry.eid, out);
                    } 

                    addTextItem(page, text, entry, crate);  

                    //const att = await la.getEntryAttachment(key, uid, e.eid);
                    //console.log(util.inspect(att, false, null));
                }
            }
        } else {
            page["@type"] = "Dataset";
            //console.log("Recursing into dir", page.name)
                                       // key, uid, nbid, parentId,       dataset, dir,   rootDir
            const done = await getPages(key, uid, nbid, node["tree-id"], page, newDir, rootDir)
        }
        fs.writeFileSync(path.join(rootDir, "ro-crate-metadata.jsonld"), JSON.stringify(crate.getJson(), null, 2))

        //const item = await la.getNode(key, uid, nbid, node['tree-id']);
        //console.log(util.inspect(item, false, null));
    }
    
}

function toDirName(string) {
    return string.replace(/\W+/g, "_").replace(/_+$/,"").toLowerCase()
}

async function main(){
    var uid;
    if (fs.existsSync(keyPath)) {
        const  keyFile = fs.readFileSync(keyPath, 'utf8');
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
        response = await la.accessInfo(key, username, token);
        var uid = response.users.id;
        console.log("Writing uid file")
        fs.writeFileSync(uidFile, uid);
    } else if (fs.existsSync(uidFile)) {
        console.log("Reading uid file")
        uid = fs.readFileSync(uidFile, 'utf8');
        if (nbid) {
            const nb = await la.getNotebookInfo(key, uid, nbid);
            //console.log(util.inspect(nb, false, null));
            if (metadataTemplate) {
                const template = JSON.parse(fs.readFileSync(metadataTemplate, 'utf8'))
                crate.json_ld["@graph"] = template["@graph"];
                crate.index();
                rootDataset = crate.getRootDataset();
            } else {
                rootDataset.name = nb.notebooks.notebook["name"];
            }

            var directory = path.join(outDir, toDirName(rootDataset.name.toLowerCase()));
            directory = path.resolve(directory);
            fs.removeSync(directory); // get rid of directory
            fs.mkdirSync(directory);
            console.log("Created output directory", directory)
            await getPages(key, uid, nbid, 0, rootDataset, "", directory);
            const preview = await new Preview(crate);
            const f = new HtmlFile(preview); 
            const html = path.join(directory, "ro-crate-preview.html");
            fs.writeFileSync(html, await f.render(cratescript));
            console.log("Wrote HTML file", html )
        } else {
            response = await la.userInfoViaId(key, uid, token);
            for (let notebook of response.users.notebooks.notebook) {
                console.log(notebook.id, notebook.name)
            }
        
            //console.log(util.inspect(response, false, null));

        }
    }
     else {
        console.log('provide username (-u) and token  (-t) and path to secret file to store the user id (-i)');
    }
}



main();


