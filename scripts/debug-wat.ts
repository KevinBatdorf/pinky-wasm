import fs from "node:fs";
import { execSync } from "node:child_process";
import { tokenize } from "../src/lexer";
import { parse } from "../src/parser";
import { compile } from "../src/compiler";

const input = fs.readFileSync("src/example.pinky", "utf8");
const { tokens } = tokenize(input);
const { ast } = parse(tokens);
const { bytes } = compile(ast);
fs.writeFileSync("debug.wasm", bytes);
execSync("wasm2wat debug.wasm -o debug.wat");
