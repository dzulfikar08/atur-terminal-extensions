import "./styles.css";
import { createRoot } from "react-dom/client";
import { ConnectionsScreen } from "./connections/connections-screen.jsx";
import { sweepTunnels } from "./lib/tunnel.js";

const EXT = "database";

function Root() {
    if (!window.atur)
        return <div className="flex h-full items-center justify-center text-muted-foreground">This page must run inside Atur Terminal</div>;
    return (
        <ConnectionsScreen
            variant="panel"
            onOpen={(conn) => atur.events.emit(`extension.${EXT}.open-connection`, { connectionId: conn.id }).catch(() => undefined)}
        />
    );
}

if (window.atur)
    sweepTunnels().catch(() => undefined);

createRoot(document.getElementById("root")).render(<Root />);
