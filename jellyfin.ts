import { Jellyfin } from "npm:@jellyfin/sdk";
import { getLibraryApi } from "@jellyfin/sdk/lib/utils/api/library-api.js";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api/items-api.js";
import { ItemFields } from "@jellyfin/sdk/lib/generated-client/models/index.js";
import { KV_DB_PATH } from "./constants.ts";

const kv = await Deno.openKv(KV_DB_PATH);

export async function init() {
  const jellyfin = new Jellyfin({
    clientInfo: {
      name: "AudioMuse Mixes",
      version: "0.1.0",
    },
    deviceInfo: {
      name: "CLI",
      id: "audiomuse-mixes-cli",
    },
  });

  const baseUrl = (await kv.get(["jellyfin", "url"])).value as string;
  const accessToken = (await kv.get(["jellyfin", "api_key"])).value as string;
  if (!baseUrl || !accessToken) {
    console.error(
      "Please run 'audiomuse-mixes configure' to set up the Jellyfin connection.",
    );
    Deno.exit(1);
  }
  const api = jellyfin.createApi(baseUrl, accessToken);

  // const libraries = await getLibraryApi(api).getMediaFolders();
  // console.log("Libraries =>", libraries.data.Items?.map((lib) => lib.Name));
  return api;
}
