import axios from "axios";
import { load } from "cheerio";
import { promises } from "fs";

const zabbixTypesToTypescript = {
    integer: "number",
    timestamp: "Date",
    text: "string"
}

function toPascalCase(text: string) {
    return text.replace(/\w+/g, function (word) {
        return word[0].toUpperCase() + word.slice(1).toLowerCase();
    }).replaceAll(" ", "");
}

async function generateType(entityName: string, pageType: string, version: string = "4.4") {
    const response = await axios.get(`https://www.zabbix.com/documentation/${version}/en/manual/api/reference/${entityName}/${pageType}`);
    const selector = load(response.data);

    const tBody = selector("table > tbody").first();

    const foo: { parameter: string, type: string, description?: string, required: boolean, isArray: boolean }[] = [];

    for (const tableRow of tBody.children()) {
        const [parameter, type, description] = selector(tableRow).find("td");

        const formattedDescription = selector(description).text().replaceAll(/(?<=[^.])\./g, ".\n\n\t\t");
        const formattedParameter = selector(parameter).text().replaceAll("(required)", "");
        const formattedType = selector(type).text().replaceAll("/array", "").replaceAll("array/", "").replaceAll("array", "string");

        foo.push({
            parameter: formattedParameter,
            type: zabbixTypesToTypescript?.[formattedType] ?? formattedType,
            isArray: selector(type).text().includes("array"),
            description: formattedDescription,
            required: selector(parameter).text().includes("(required)")
        });
    }

    let interfaceText = `export interface ${toPascalCase(`${entityName} ${pageType === "object" ? "" : pageType}`)} {`;

    for (const { parameter, type, description, required, isArray } of foo) {
        interfaceText += (`
    /**
        ${description}
    */
    ${parameter}${required ? "" : "?"}: ${zabbixTypesToTypescript?.[type] ?? type}${isArray ? "[]" : ""};
`);
    }

    interfaceText += "}";

    await promises.mkdir(`./output/${version}/${entityName}`, {
        recursive: true
    });

    await promises.writeFile(`./output/${version}/${entityName}/${entityName}${pageType === "object" ? "" : `-${pageType}`}.ts`, interfaceText, {
        flag: "w"
    });
}

function main() {
    const versions = [
        "6.4",
        "6.0",
        "5.0",
        "6.2",
        "5.4",
        "5.2",
        "4.4",
        "4.2",
        "4.0"
    ];

    const pageTypes = [
        "object",
        "create",
        "delete",
        "get",
        "update"
    ];

    const entities = [
        "application",
        "host",
        "trigger",
        "hostgroup"
    ];

    for (const version of versions) {
        for (const entity of entities) {
            for (const pageType of pageTypes) {
                generateType(entity, pageType, version);
            }
        }
    }


}

main();