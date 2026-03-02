export default function (state, event) {
  if (event.kind === "start" || event.kind === "reload") {
    return [["2A37", "AAEC"]];
  }
  if (event.kind === "notify") {
    return [["2A37", event.payload]];
  }
  return [];
}
