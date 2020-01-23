# Export Labarchives to ro-crate packages

This is a work-in-progress script to create data packages conforming to the
RO-Crate Research Data packaging standard from LabArchives notebooks.

## Audience

This is for experienced node developers only at the moment.

## Status

This is a proof of concept.

TODO: 
- [ ] More extensive testing that "that look about right"
- [ ] Review the modeling of notebooks in RO-Crate
- [ ] Export comments
- [ ] Refine the way HTML is generated

## Install

- Download the code using git.

-  From the commandline type:

   `npm install . --local`

Add details of the the LabArchives server you want to use to a file named `key.json`.
```
{
    "akid": "utech_sydney",
    "password": "----SECRET-----",
    "baseurl": "https://au-mynotebook.labarchives.com",
    "api": "/api"
  }
```
## Run

NOTE: Lab archives uses two kinds of ID. You can use a temporary "Password Token for External applications" to get access or there is a permanent User ID which gives you API access. The recommended way to use the API is to fetch the User ID using the temporary token then store it.

- For usage information use:
    `node export.js --help`

Response:
```
Usage: export [options]

Exports RO-Crate data packages from LabArchives - uses the 

Options:
  -V, --version                             output the version number
  -l,  --list-notebooks                     List notebooks
  -m --metadata [ro-crate-metadata.jsonld]  RO-Crate metadata file to use as a template for the root dataset and contextual entities (eg people)
  -u --username                             Email address used for LabArchives login
  -i --user-id  [file]                      Path to a file containing a LabArchives user ID secret
  -t --password-token [token]               Lab Arvhives 'Password Token for External applications' via the menu that shows your name at top right of the webiste under 'LA App Authentication
  -n,  --notebook-id [nbid]                 ID of the notebook to export. Get a list via -l
  -c --cratescript [crate]                  URL to the RO-Crate rendering script
  -h, --help                                output usage information


```

### Get a user-id and write it to a file

- To get a secret ID, use:
   `node export.js -u email@example.com -t TOKEN  ~/.lauid`


### Get a list of notebooks

-  To get a list of notebooks to which you have access use this command:
    `node export.js -l -i ~/.lauuid`

Response:
```
NDYyMjIuOHwzNTU1Ni8zNTU1Ni9Ob3RlYm9vay8zMzc3ODg5ODY0fDExNzMzNC43OTk5OTk5OTk5OQ== Backup - Shared UTS procedures
NDYyMjQuMXwzNTU1Ny8zNTU1Ny9Ob3RlYm9vay80OTA2Nzk4NDF8MTE3MzM4LjA5OTk5OTk5OTk5 Backup - Template Supervise HDRS - copy
...
NDI0NDEuMXwzMjY0Ny8zMjY0Ny9Ob3RlYm9vay8zMjk5NTc3NzkxfDEwNzczNS4wOTk5OTk5OTk5OQ== UTS Rollout materials - use this to collaborate!

```
### Export a notebook

To export a notebook given its use one of the IDs:

```
node export.js -t test -i ~/.lauuid -n NDI0NDEuMXwzMjY0Ny8zMjY0Ny9Ob3RlYm9vay8zMjk5NTc3NzkxfDEwNzczNS4wOTk5OTk5OTk5OQ==  -m samples/tse/ro-crate-metadata.jsonld
```


To export Edwin Tse's exemplary notebook on Open Malaria drug research with
addition metadata from an existing RO-Crate using the `-m` option (WARNING: This is
a BIG notebook):

```
node export.js -t test -i ~/.lauuid -n MTYzLjh8MTUwOS8xMjYvVHJlZU5vZGUvMjUxNDEwNDEwOHw0MTUuOA==  -m samples/tse/ro-crate-metadata.jsonld
```




