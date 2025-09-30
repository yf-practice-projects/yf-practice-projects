import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { compile }  from 'json-schema-to-typescript'

const inputFile = './dist/openapi.yaml'
const outputFile = '../src/types/schemas.ts'

function rewriteRefs(obj: any) {
  if(Array.isArray(obj)){
    obj.forEach(rewriteRefs)
  }else if (typeof obj === 'object' && obj !== null){
    for (const key of Object.keys(obj)){
      if(key === '$ref' && typeof obj[key] === 'string'){
        obj[key] = obj[key].replace(
          /^#\/components\/schemas\//,
          '#/definitions/'
        );
      } else {
        rewriteRefs(obj[key])
      }
    }
  }
}

function enforceAdditionalProperties(obj: any){
  if(Array.isArray(obj)){
    obj.forEach(enforceAdditionalProperties);
  }else if(typeof obj === 'object' && obj !== null){
    if(obj.type === 'object' && obj.additionalProperties === undefined) {
      obj.additionalProperties = false;
    }
    for(const key of Object.keys(obj)){
      enforceAdditionalProperties(obj[key]);
    }
  }
}

async function main(){
  try {
    const doc = yaml.load(fs.readFileSync(inputFile, 'utf8')) as any;

    const schema = doc.components.schema;

    const allSchemas = JSON.parse(JSON.stringify(schema));
    rewriteRefs(allSchemas);
    enforceAdditionalProperties(allSchemas);

    const results: string[] = [];

    for(const [name, schema] of Object.entries(allSchemas)) {
      if(name === 'Object'){
        continue;
      }

      const individualSchema = JSON.parse(JSON.stringify(schema));
      rewriteRefs(allSchemas);
      enforceAdditionalProperties(allSchemas);

      const withDefinitions = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: name,
        definitions:allschemas,
        ...individualSchema,
      };
      const ts = await compile(withDefinitions, name, {
        bannerComment: '',
        style: {
          singleQuote: true,
        }
      });
      results.push(ts)
    }

    fs.writeFileSync(outputFile, results.join('\n\n'));
    console.log('generated success')
  } catch(err) {
    console.log(err)
  }
}
main();
