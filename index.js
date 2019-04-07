const csv = require('csvtojson'),
    pdf = require('html-pdf'),
    Handlebars = require('handlebars'),
    tmp = require('tmp'),
    merge = require('easy-pdf-merge'),
    fs = require('fs'),
    puppeteer = require('puppeteer');

function reducer(newArr, tmpObj) {
    newArr.push(tmpObj.name);
    return newArr;
}

async function process(templatePath, csvPath, outputPath) {
    tmpArray = [];
    try {
        console.time('timer');
        let template = Handlebars.compile(fs.readFileSync(templatePath).toString());

        let dataArray = await csv().fromFile(csvPath);

        for (let i = 0; i < dataArray.length; i += 2) {
            let data = {
                name1: dataArray[i].Name,
                name2: null,
                path: __dirname
            }

            if (i + 1 < dataArray.length) {
                data.name2 = dataArray[i + 1].Name;
            }

            let tmpObj = tmp.fileSync({ postfix: '.pdf' });
            tmpArray.push(tmpObj);

            // let generated = await new Promise((resolve, reject) => {
            //     pdf.create(template(data), { quality: 100, renderDelay: 1000 }).toFile(tmpObj.name, (err, res) => {
            //         if (err) {
            //             reject(err);
            //             return;
            //         }

            //         resolve(res);
            //     });
            // });

            let browser = await puppeteer.launch();
            let page = await browser.newPage();
            
            await page.setContent(template(data));
            await page.emulateMedia('screen');
            await page.pdf({
                path: tmpObj.name,
                format: 'Letter',
                printBackground: true
            });

            await browser.close();

            console.log(`${i + 2}/${ dataArray.length }: PDF file for ${data.name1} and ${data.name2} has been generated @ ${tmpObj.name}`);
        }

        console.log('Generation complete. Compiling...');

        let pathArray = tmpArray.reduce(reducer, []);

        await new Promise((resolve, reject) => {
            merge(pathArray, outputPath, err => {
                if (err) {
                    reject(err);
                    return;
                }
    
                resolve(outputPath);
            });
        });

        console.log('Compilation complete.');

    } catch (error) {
        console.log('An error was encountered!');
        console.log(error);
    } finally {
        console.log('Cleaning up .tmp files');
        tmpArray.forEach(tmpObj => {
            tmpObj.removeCallback();
        });
        console.log('Cleanup complete. Terminating.');
        console.timeEnd('timer');
    }
}

process('./template.html', './attendees.csv', 'results.pdf');