import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { terminal } from "spectrum-ts/providers/terminal";
import { createTextAgent } from "./agent.ts";

const args = process.argv.slice(2);
const cloudMode = args.includes("--imessage");

async function main(): Promise<void> {
  if (args.some((arg) => arg !== "--imessage")) {
    throw new Error("Use npm start for terminal mode or npm start -- --imessage for cloud mode.");
  }

  const agent = createTextAgent({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL });
  const app = await createApp();

  const stop = (): void => {
    void app.stop();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    for await (const [space, message] of app.messages) {
      if (message.direction === "inbound" && message.content.type === "text") {
        const phone = message.platform === "imessage" ? imessage(space).phone : undefined;
        const conversationId = JSON.stringify([message.platform, phone, space.id, message.sender?.id]);
        await space.send(await agent.reply(conversationId, message.content.text));
      }
    }
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    await app.stop();
  }
}

async function createApp() {
  if (!cloudMode) {
    return Spectrum({
      providers: [terminal.config()],
      options: { logLevel: "error" },
      telemetry: false,
    });
  }

  const projectId = process.env.SPECTRUM_PROJECT_ID?.trim();
  const projectSecret = process.env.SPECTRUM_PROJECT_SECRET?.trim();
  if (!projectId || !projectSecret) {
    throw new Error("Cloud mode requires SPECTRUM_PROJECT_ID and SPECTRUM_PROJECT_SECRET.");
  }

  return Spectrum({
    projectId,
    projectSecret,
    providers: [imessage.config()],
    options: { logLevel: "error" },
    telemetry: false,
  });
}

main().catch((error: unknown) => {
  if (error instanceof Error && (error.message.startsWith("Use npm start") || error.message.startsWith("Cloud mode requires"))) {
    console.error(error.message);
  } else {
    console.error("Photon could not run. Check the provider setup and your network connection. Credentials and message content were omitted from this error.");
  }
  process.exitCode = 1;
});
