const fs = require('fs-extra');
const path = require('path');
const ROCrate = require("ro-crate").ROCrate;
const Preview = require("ro-crate-html-js").Preview;
const HtmlFile = require("ro-crate-html-js").HtmlFile;
const la = require('@uts-eresearch/provision-labarchives');

module.exports = class LaToRoCrate {

  constructor(key, outDir, metadataFileName, log) {
    this.key = key;
    this.outDir = outDir;
    this.metadataFileName = metadataFileName || "ro-crate-metadata.json";
    this.log = log;
  }

  addTextItem(page, text, entry, type, crate) {
    page.hasPart.push(
      {
        "@id": `#${entry.eid}`
      }
    );
    crate.getGraph().push({
      "@id": `#${entry.eid}`,
      "@type": [type],
      "articleBody": text,
      "dateCreated": entry["created-at"]["_"],
      "contributor": entry["last-modified-by"],
      "version": entry["version"]["_"],
      "description": `${entry["last-modified-verb"]} by ${entry["last-modified-by"]} at ${entry["created-at"]["_"]}`
    });
  }

  toDirName(string) {
    return string.replace(/\W+/g, "_").replace(/_+$/, "").toLowerCase()
  }

  async getPagesSync(uid, nbid, parentId, dataset, dir, rootDir, crate, pageMetaDescription) {
    try {
      const tree = await la.getTree(this.key, uid, nbid, parentId);
      let count = 0;
      let levelNodes = tree["tree-tools"]["level-nodes"]['level-node']
      if (!Array.isArray(levelNodes)) {
        levelNodes = [levelNodes];
      }
      dataset.hasPart = [];
      for (let node of levelNodes) {
        if (!node) {
          break;
        }
        let page = {};
        page.name = node["display-text"];
        let dirName = this.toDirName(page.name);
        // TODO: IF EXISTS MAKE ANOTHER ONE!!!
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
          if(this.log) console.log("Page:", page.name, "\r");
          //console.log(dataset);
          //console.log(rootDataset);
          //console.log("CRATE", JSON.stringify(crate.getJson()));
          page.articleBody = "";
          page["@type"].push("Article");

          const pageEntries = await la.getEntriesForPage(this.key, uid, nbid, node['tree-id']);
          page.text = [];
          //console.log(util.inspect(pageEntries, false, null));
          let entries = pageEntries["tree-tools"].entries.entry;
          // TODO - make entry dirs?
          if (entries) {
            if (!Array.isArray(entries)) {
              entries = [entries];
            }

            for (let entry of entries) {
              // This is the ID to use for entries - will prepend # for ones that are not files
              const entryUrl = path.join(newDir, entry.eid);
              fs.mkdirpSync(path.join(rootDir, entryUrl));
              // Write a copy of the JSON metadata
              let apiFileName = `api${count++}.json`;
              let jsonId = path.join(entryUrl, apiFileName);
              const json = {"@id": jsonId};
              json["@type"] = "File";
              json.name = apiFileName;
              json["description"] = pageMetaDescription || "JSON Metadata from the LabArchives API as retrieved";
              json.url = entry["entry-url"]
              crate.getGraph().push(json);
              page.hasPart.push({"@id": jsonId});
              const jsonPath = path.join(rootDir, jsonId);
              fs.writeFileSync(jsonPath, JSON.stringify(entry, null, 2));

              //console.log("Setting outDir", this.outDir);
              //console.log("Getting entry with ID:", entry.eid);
              let text = "";
              if (entry['part-type'] === "heading") {
                text += `<h1>${entry["entry-data"]}</h1>`
              } else if (entry["entry-data"] && !(entry["entry-data"]["$"] && entry["entry-data"]["$"]['nil'] === 'true')) {
                // TODO Make separate pages w/ entries
                text += entry["entry-data"];
              }
              //const entry = await la.getEntry(this.key, uid, e.eid);
              //console.log(util.inspect(entry, false, null));

              if (entry["part-type"] === "widget entry" && entry["snapshot"] === "snapshot_exists") {
                const filename = await la.getSnapshot(this.key, uid, entry.eid, path.join(rootDir, entryUrl));

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
                await la.getEntryAttachment(this.key, uid, entry.eid, out);
              }

              this.addTextItem(page, text, entry, "Article", crate);

              //const att = await la.getEntryAttachment(this.key, uid, e.eid);
              //console.log(util.inspect(att, false, null));
            }
          }
        } else {
          page["@type"] = "Dataset";
          if (this.log) console.log("Recursing into dir", page.name);
          // key, uid, nbid, parentId,       dataset, dir,   rootDir
          const done = await this.getPagesSync(uid, nbid, node["tree-id"], page, newDir, rootDir, crate, pageMetaDescription);
        }
        fs.writeFileSync(path.join(rootDir, this.metadataFileName), JSON.stringify(crate.getJson(), null, 2))

        //const item = await la.getNode(this.key, uid, nbid, node['tree-id']);
        //console.log(util.inspect(item, false, null));
      }
    } catch (e) {
      if (this.log) console.log('getPagesSync error, parentId: ' + parentId);
      throw new Error(e);
    }
  }

  async exportNotebookSync(uid, nbid, rootDatasetName, outputDirectoryName, cratescript, metadataTemplate, pageMetaDescription) {
    try {
      const crate = new ROCrate();
      crate.index();
      var rootDataset = crate.getRootDataset();
      if (metadataTemplate) {
        const template = JSON.parse(fs.readFileSync(metadataTemplate, 'utf8'));
        crate.json_ld["@graph"] = template["@graph"];
        crate.index();
        rootDataset = crate.getRootDataset();
      } else {
        rootDataset.name = rootDatasetName
      }

      let directory = path.join(this.outDir, this.toDirName(outputDirectoryName));
      directory = path.resolve(directory);
      fs.removeSync(directory); // get rid of directory
      fs.mkdirSync(directory);
      if (this.log) console.log("Created output directory", directory);
      //TODO: Create another class for getPages and getPagesSync for easier manipulation
      await this.getPagesSync(uid, nbid, 0, rootDataset, "", directory, crate, pageMetaDescription);
      const preview = await new Preview(crate);
      const f = new HtmlFile(preview);
      const html = path.join(directory, "ro-crate-preview.html");
      fs.writeFileSync(html, await f.render(cratescript));
      if (this.log) console.log("Wrote HTML file", html);
    } catch (e) {
      console.log('exportNotebook error, notebookId: ' + nbid);
      throw new Error(e);
    }
  }

}
