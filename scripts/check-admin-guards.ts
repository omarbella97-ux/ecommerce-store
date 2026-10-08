// Fails if any admin page, layout, Server Action or admin data helper can run
// without checking the admin role. Run before committing admin changes:
//   pnpm check:admin            (checks ./src)
//   pnpm check:admin <root>     (checks <root>/src — used to test this script)
//
// Rules:
// 1. Every page.tsx / layout.tsx under src/app/admin calls requireAdmin().
// 2. In every "use server" file under src/app/admin, every src/lib/admin-*.ts
//    (except the pure admin-validation.ts), and every other "use server" file
//    that imports the admin data helpers, each exported async function's
//    first statement is `await requireAdmin(…)` (or `const x = await …`).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";

const root = process.argv[2] ?? process.cwd();
const src = join(root, "src");
const ADMIN_APP = join(src, "app", "admin");
const ADMIN_DATA_IMPORT = /^@\/lib\/admin-(catalogue|orders)$/;
const PURE_ADMIN_LIBS = new Set(["admin-validation.ts"]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : walk(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

function parse(path: string): ts.SourceFile {
  return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
}

const isRequireAdminCall = (node: ts.Node): boolean =>
  ts.isCallExpression(node) &&
  ts.isIdentifier(node.expression) &&
  node.expression.text === "requireAdmin";

function callsRequireAdmin(node: ts.Node): boolean {
  return isRequireAdminCall(node) || (ts.forEachChild(node, callsRequireAdmin) ?? false);
}

const isAwaitedRequireAdmin = (expr: ts.Expression | undefined): boolean =>
  !!expr && ts.isAwaitExpression(expr) && isRequireAdminCall(expr.expression);

function startsWithRequireAdmin(body: ts.ConciseBody | undefined): boolean {
  if (!body || !ts.isBlock(body)) return false;
  const [first] = body.statements;
  if (!first) return false;
  if (ts.isExpressionStatement(first)) return isAwaitedRequireAdmin(first.expression);
  if (ts.isVariableStatement(first)) {
    const [declaration] = first.declarationList.declarations;
    return first.declarationList.declarations.length === 1 && isAwaitedRequireAdmin(declaration.initializer);
  }
  return false;
}

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) =>
  ts.canHaveModifiers(node) && (ts.getModifiers(node)?.some((m) => m.kind === kind) ?? false);

// A module-level directive must be the file's first statement.
const hasUseServer = (file: ts.SourceFile) => {
  const [first] = file.statements;
  return (
    !!first &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression) &&
    first.expression.text === "use server"
  );
};

const importsAdminData = (file: ts.SourceFile) =>
  file.statements.some(
    (s) => ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier) && ADMIN_DATA_IMPORT.test(s.moduleSpecifier.text),
  );

/** Exported async functions (declarations and `export const x = async …`). */
function exportedAsyncFunctions(file: ts.SourceFile) {
  const found: { name: string; line: number; body: ts.ConciseBody | undefined }[] = [];
  const line = (node: ts.Node) => file.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  for (const statement of file.statements) {
    if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
    if (ts.isFunctionDeclaration(statement) && hasModifier(statement, ts.SyntaxKind.AsyncKeyword)) {
      found.push({ name: statement.name?.text ?? "default", line: line(statement), body: statement.body });
    }
    if (ts.isVariableStatement(statement)) {
      for (const d of statement.declarationList.declarations) {
        const init = d.initializer;
        if (
          init &&
          (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) &&
          hasModifier(init, ts.SyntaxKind.AsyncKeyword)
        ) {
          found.push({ name: d.name.getText(file), line: line(d), body: init.body });
        }
      }
    }
  }
  return found;
}

const problems: string[] = [];
const rel = (path: string) => relative(root, path).split(sep).join("/");
let checkedFunctions = 0;
let checkedRoutes = 0;

for (const path of walk(src)) {
  const inAdminApp = path.startsWith(ADMIN_APP + sep);
  const name = path.slice(path.lastIndexOf(sep) + 1);
  const isAdminLib =
    path.startsWith(join(src, "lib") + sep) && /^admin-.*\.ts$/.test(name) && !PURE_ADMIN_LIBS.has(name);
  const file = parse(path);

  if (inAdminApp && /^(page|layout)\.tsx$/.test(name)) {
    checkedRoutes++;
    if (!callsRequireAdmin(file)) problems.push(`${rel(path)}: admin ${name.replace(".tsx", "")} never calls requireAdmin()`);
  }

  const useServer = hasUseServer(file);
  if (isAdminLib || (useServer && (inAdminApp || importsAdminData(file)))) {
    for (const fn of exportedAsyncFunctions(file)) {
      checkedFunctions++;
      if (!startsWithRequireAdmin(fn.body)) {
        problems.push(`${rel(path)}:${fn.line} ${fn.name}() must start with \`await requireAdmin()\``);
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`Admin guard check failed (${problems.length}):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`Admin guard check passed: ${checkedRoutes} pages/layouts, ${checkedFunctions} actions/helpers.`);
