export type EngineSource = "env" | "user";

export type EngineDescriptor = {
  id: string;
  label: string;
  url: string;
  source: EngineSource;
  serverAllowlisted: boolean;
};

export type ServerEngineEntry = {
  id: string;
  label: string;
  url: string;
};

export type ClientEngineSeed = ServerEngineEntry;
