const { PromisedDatabase } = require("@sqlite3-libs/promised-sqlite3");
const db = new PromisedDatabase();
import { getWithTimeout } from "./fetchWithTimeout";

db.open(":memory:");
db.run("CREATE TABLE render_hosts (public_hostname TEXT NOT NULL, agent_port INTEGER NOT NULL, gpu_count INTEGER NOT NULL, gpu_data TEXT,	UNIQUE(public_hostname));", function(createResult: any){
  if(createResult) throw createResult;
});

interface AliveAgentStats {
  uptimeMs: number;
  numSessions: number;
}

interface AgentStatus {
  agent: Agent;
  isAlive: boolean;
  stats: AliveAgentStats | undefined;
  reason: string;
}

export function getURL(agent: Agent, path: string): URL {
  return new URL(path, agent.url);
}

async function checkStatus(agent: Agent): Promise<AgentStatus> {
  function makeDead(reason: string): AgentStatus {
    return { agent, isAlive: false, stats: undefined, reason: reason };
  }

  try {
    const res = await getWithTimeout(getURL(agent, "/status"));
    const status = res["status"];
    if (status === "ok") {
      return {
        isAlive: true,
        agent,
        reason: "ok",
        stats: {
          // TODO: validate these
          numSessions: res["num_sessions"],
          uptimeMs: res["uptime_ms"],
        },
      };
    } else {
      return makeDead(status);
    }
  } catch (err) {
    return makeDead(err as string);
  }
}

export interface Agent {
  url: URL;
  data: any;
}

export async function getAllHosts(): Promise<Agent[]> {
  const rows = await db.all("SELECT public_hostname, agent_port, gpu_data FROM render_hosts;");
  
  return rows.map((row: any) => {
    const host = row.public_hostname;
    const port = row.agent_port;
    const data = JSON.parse(row.gpu_data);
    // TODO: https vs http?
    const url = new URL(`http://${host}:${port}`);
    return { url, data };
  });
}

export async function getHostState(): Promise<AgentStatus[]> {
  const hosts = await getAllHosts();
  return await Promise.all(hosts.map(checkStatus));
}

export async function getOnlineHosts(): Promise<Agent[]> {
  const state = await getHostState();
  const online = state.filter((s) => s.isAlive);
  return online.map((s) => s.agent);
}

export async function addHost(host: string, port: number, gpu_count: number, gpudata: string): Promise<void> {
  // TODO: ON CONFLICT update timestamp
  await db.run("INSERT INTO render_hosts (public_hostname, agent_port, gpu_count, gpu_data) VALUES ($1, $2, $3, $4) " +
    "ON CONFLICT (public_hostname) DO " +
    "UPDATE SET agent_port = $2, gpu_count = $3, gpu_data = $4;",
      {
        $1: host,
        $2: port,
        $3: gpu_count,
        $4: JSON.stringify(gpudata)
      });
}

export async function updateHosts(hosts: string[]): Promise<void> {
  await db.run("DELETE FROM render_hosts;");
  await db.run("INSERT INTO render_hosts(public_hostname) VALUES($1);", {$1:  hosts});
}
