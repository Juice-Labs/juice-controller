import * as fs from "fs/promises";
import express from "express";
import morgan from "morgan";
import * as hoststore from "../src/hoststore_sqlite";
import { postWithTimeout } from "../src/fetchWithTimeout";

import * as CommandLine from "../src/commandline";
import * as Logging from "../src/logging";

// Initialize the logging system here to allow imports to use it
Logging.configure(CommandLine.argv);

async function main(): Promise<void> {
  if (!CommandLine.argv.nobanner) {
    Logging.always("Juice Agent, version %s", process.env.npm_package_version);
    Logging.always("Copyright 2021-2022 Juice Technologies, Inc.");
  }

  try {
    await fs.mkdir(CommandLine.argv.logs);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
      throw err;
    }
  }

  const app = express();
  app.use(morgan("combined"));
  app.use(express.json());
  app.use(
    express.urlencoded({
      extended: true,
    })
  );

  app.get("/connect", async (req, res) => {
      try {
        const good = await hoststore.getOnlineHosts();
        if (good.length === 0) {
          res.status(500).json({ msg: "No valid hosts" });
        } else {
          const randAgent = good[Math.random() * (good.length - 1)];
          const resp = await postWithTimeout(
            hoststore.getURL(randAgent, "/connect"),
            {}
          );

          const ports = resp["ports"];
          const client_uuid = resp["uuid"];
          if (!ports || !ports.length || !client_uuid || !client_uuid.length) {
            res
              .status(500)
              .send(`bad response from agent: ${JSON.stringify(resp)}`);
          } else {
            res.status(200).json({
              uuid: client_uuid,
              host: randAgent.url.hostname,
              ports: ports,
            });
          }
        }
      } catch (err) {
        Logging.error(err);
        res.status(500).send(err);
      }
    }
  );

  app.post("/ping", async (req, res) => {
      try {
        // Strip local IP v6 prefix if it appears
        const host = req.ip.replace(/^(::ffff:)/, "");
        let port = req.body.port;
        req.body.ip = host;
        if (typeof port !== "number") {
          res.status(400).send("Missing port");
          return;
        }

        await hoststore.addHost(host, port, req.body.gpu_count, req.body);
        res.status(200).json({});
      } catch (err) {
        Logging.error(err);
        res.status(500).send(err);
      }
    }
  );

  app.get("/status", async (req, res) => {
      try {
        var hosts = [];
        const statii = await hoststore.getHostState();
        for(let i = 0; i < statii.length; ++i)
        {
          hosts.push(statii[i].agent.data);
        }
        res.status(200).json(hosts);
      } catch (err) {
        Logging.error(err);
        res.status(500).send(err);
      }
    }
  );

  app.listen(CommandLine.argv.port, CommandLine.argv.ip, () => {
    console.log(`Listening at http://${CommandLine.argv.ip}:${CommandLine.argv.port}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
