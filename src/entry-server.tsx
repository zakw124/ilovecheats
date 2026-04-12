import React from "react";
import { renderToString } from "react-dom/server";
import App from "./App";
import type { InitialAppData } from "./types";

export function render(url: string, initialData: InitialAppData = {}) {
  const route = url.split("?")[0]?.split("/")[1] || "home";

  return renderToString(
    <React.StrictMode>
      <App initialData={initialData} initialRoute={route} />
    </React.StrictMode>
  );
}
