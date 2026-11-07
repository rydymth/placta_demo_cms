import { createInterface } from "node:readline/promises";

export async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  }
  finally {
    rl.close();
  }
}

// Reads a line without echoing it. Needs a real terminal.
export function askHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) return reject(new Error("A password prompt needs an interactive terminal"));

    let buffer = "";
    const done = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          done();
          stdout.write("\n");
          return resolve(buffer);
        }
        if (ch === "\u0003") {
          done();
          return reject(new Error("Cancelled"));
        }
        buffer = ch === "\u007f" || ch === "\b" ? buffer.slice(0, -1) : buffer + ch;
      }
    };

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.on("data", onData);
  });
}
