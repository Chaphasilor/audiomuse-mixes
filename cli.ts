import { Spinner } from "@std/cli/unstable-spinner";
import { Command } from "@cliffy/command";
import { Confirm, Input, Secret, Select } from "@cliffy/prompt";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api/items-api.js";
import { getPlaylistsApi } from "@jellyfin/sdk/lib/utils/api/playlists-api.js";
import * as Jellyfin from "./jellyfin.ts";

import {
  calculateEdgeWeights,
  chooseRandomNodeInRadiusOf,
  parseVectorSpace,
} from "./vector-space-analysis.ts";
import { KV_DB_PATH } from "./constants.ts";

const cachePaths = {
  vectorSpace: `./vector-space.cache.json`,
  edgeWeights: `./edge-weights.cache.json`,
};

const kv = await Deno.openKv(KV_DB_PATH);

const commandConfigure = await new Command()
  .name(`configure`)
  .alias("config")
  .alias("c")
  .description(
    "Configure credentials. Either pass them as flags or enter them interactively.",
  )
  .option("-u, --url <url:string>", "Jellyfin server URL", {
    required: false,
  })
  .option("-k, --key <key:string>", "Jellyfin API key", {
    required: false,
  })
  .option("-i, --id <id:string>", "Jellyfin user ID", {
    required: false,
  })
  .option("-s, --seed <seed:string>", "Random seed (optional)", {
    required: false,
  })
  .action(async (options) => {
    if (!options.url) {
      options.url = await Input.prompt({
        message: "Enter Jellyfin server URL",
      });
    }
    if (!options.key) {
      options.key = await Secret.prompt({
        message: "Enter Jellyfin API key",
      });
    }
    if (!options.id) {
      options.id = await Input.prompt({
        message: "Enter Jellyfin user ID",
      });
    }

    await kv.set(["jellyfin", "url"], options.url);
    await kv.set(["jellyfin", "api_key"], options.key);
    await kv.set(["jellyfin", "user_id"], options.id);
    if (options.seed) {
      await kv.set(["randomseed"], options.seed);
    }
  });

async function resetCredentials() {
  await kv.delete(["jellyfin", "url"]);
  await kv.delete(["jellyfin", "api_key"]);
  await kv.delete(["jellyfin", "user_id"]);
  await kv.delete(["randomseed"]);
  console.log(
    `All credentials have been reset. You can now run 'audiomuse-mixes configure' to set them up again.`,
  );
}

async function resetWeights() {
  try {
    if (await Deno.stat(cachePaths.vectorSpace).catch(() => false)) {
      await Deno.remove(cachePaths.vectorSpace);
    }
    if (await Deno.stat(cachePaths.edgeWeights).catch(() => false)) {
      await Deno.remove(cachePaths.edgeWeights);
    }
  } catch (err) {
    console.error(`Error removing cache files:`, err);
  }
  console.log(
    `All weights have been reset. They will be recalculated on next run.`,
  );
}

const commandReset = await new Command()
  .name(`reset`)
  .description(
    "Reset stored credentials.",
  )
  .command(
    `credentials`,
    new Command()
      .description("Reset Jellyfin credentials")
      .action(async () => {
        await resetCredentials();
      }),
  )
  .command(
    `weights`,
    new Command()
      .description("Reset generated vector space and edge weights")
      .action(async () => {
        await resetWeights();
      }),
  )
  .command(
    `all`,
    new Command()
      .description("Reset all generated data")
      .action(async () => {
        await resetCredentials();
        await resetWeights();
      }),
  )
  .reset()
  .action(function () {
    this.showHelp();
  });

const commandWeights = await new Command()
  .name("weights")
  .alias("w")
  .description("Calculate edge weights for the vector space")
  .option(
    "-i, --input <path>",
    "Vector JSON file path. Obtained by exporting AudioMuse's 'score' table to JSON.",
    {
      required: true,
    },
  )
  .action(async (options: {
    input: string;
  }) => {
    console.log(`Options:`, options);

    const spinner = new Spinner({
      message: "Parsing Vector Space...",
    });
    spinner.start();

    // import and parse json file from arguments
    const filePath = options.input;
    let jsonData;
    try {
      const data = await Deno.readTextFile(filePath);
      jsonData = JSON.parse(data);
    } catch (error) {
      console.error(`Error reading or parsing the file:`, error);
      Deno.exit(1);
    }
    // console.log(`JSON data:`, jsonData);

    const _parsedVectorSpace: VectorSpace = await parseVectorSpace(
      jsonData,
      cachePaths.vectorSpace,
    );
    // console.log(`_parsedVectorSpace:`, _parsedVectorSpace);

    const _edgeWeights: EdgeWeights = await calculateEdgeWeights(
      _parsedVectorSpace,
      cachePaths.edgeWeights,
    );
    // console.log(`edgeWeights:`, edgeWeights);

    spinner.stop();
    console.log(`Edge weights calculated and stored.`);
  });
const commandMix = await new Command()
  .name("mix")
  .alias("m")
  .description("Search for a track and generate a playlist of similar tracks")
  .option("-t, --track <trackId:string>", "ID of the initial track", {})
  .option(
    "-l --length <playlistLength:integer>",
    "Length of the playlist",
    {
      default: 10,
    },
  )
  .option(
    "--rn, --radiusNext <radiusNext:number>",
    "Search radius for next track",
    {
      default: 0.3,
    },
  )
  .option(
    "--rg, --radiusGlobal <radiusGlobal:number>",
    "Search radius for global track",
    {
      default: 0.35,
    },
  )
  .option(
    "--grs, --globalRadiusScaler <globalRadiusScaler:number>",
    "Global radius scaler for next track",
    { default: 0.005 },
  )
  .action(async (options) => {
    console.log(`Options:`, options);

    const cachedVectorSpace: VectorSpace = await Deno.readTextFile(
      cachePaths.vectorSpace,
    ).then((data) => {
      try {
        return JSON.parse(data);
      } catch (error) {
        console.error(`Error parsing cached vector space:`, error);
        return null;
      }
    }).catch(() => {
      console.error(
        `No cached vector space found! Please run 'audiomuse-mixes weights' first...`,
      );
      Deno.exit(1);
    });

    // console.log(`cachedVectorSpace:`, cachedVectorSpace);

    const cachedEdgeWeights: EdgeWeights = await Deno.readTextFile(
      cachePaths.edgeWeights,
    ).then((data) => {
      try {
        return JSON.parse(data);
      } catch (error) {
        console.error(`Error parsing cached edge weights:`, error);
        return null;
      }
    }).catch(() => {
      console.error(
        `No cached edge weights found! Please run 'audiomuse-mixes weights' first...`,
      );
      Deno.exit(1);
    });
    // console.log(`cachedEdgeWeights:`, cachedEdgeWeights);

    const jellyfin = await Jellyfin.init();

    if (!options.track) {
      // import jellyfin and search for track
      let chosenTrack;
      do {
        const trackSearchQuery = await Input.prompt({
          message: "Search for a track",
        });
        const trackSearchResults = (await getItemsApi(jellyfin).getItems({
          searchTerm: trackSearchQuery,
          includeItemTypes: ["Audio"],
          recursive: true,
        })).data;
        // console.log(`trackSearchResults:`, trackSearchResults);
        const trackOptions = trackSearchResults.Items?.map(
          (item) => ({
            name: `'${item.Name ?? "Unknown Name"}' by ${
              item.Artists?.join(", ") ?? "Unknown Artist"
            }`,
            value: item.Id!,
          }),
        );
        const availableTracks = trackOptions?.filter(
          (track) => cachedVectorSpace[track.value],
        );
        const unavailableTracks = trackOptions?.filter(
          (track) => !cachedVectorSpace[track.value],
        ).map(
          (track) => ({
            ...track,
            name: `${track.name} (Not in vector space)`,
            disabled: true,
          }),
        );
        chosenTrack = await Select.prompt<string>({
          message: `Results for '${trackSearchQuery}'`,
          options: [
            ...availableTracks ?? [],
            Select.separator("----------------------------"),
            { name: "New Search", value: "new-search" },
            { name: "Manual ID Input", value: "manual" },
            Select.separator("---- Unavailable Tracks ----"),
            ...unavailableTracks ?? [],
          ],
        });
      } while (chosenTrack === "new-search");
      if (chosenTrack === "manual") {
        options.track = await Input.prompt({
          message: "Enter the track ID manually",
        });
      } else {
        options.track = chosenTrack;
      }
    }

    const initialTrack: ParsedNode[`item_id`] = options.track;
    if (!initialTrack || !cachedVectorSpace[initialTrack]) {
      console.error(
        `Please provide a valid initial track ID as the second argument.`,
      );
      Deno.exit(1);
    }

    const playlist: Array<PlaylistItem> = [
      {
        item_id: initialTrack,
        distanceToPrevious: 0,
        distanceToInitial: 0,
      },
    ];
    const playlistLength = Math.min(
      options.length,
      Object.entries(cachedVectorSpace).length,
    );

    let nextTrack = chooseRandomNodeInRadiusOf(
      cachedVectorSpace[playlist[0].item_id],
      options.rn,
      options.rg,
      cachedEdgeWeights,
      playlist,
    );

    while (playlist.length < playlistLength && nextTrack != null) {
      playlist.push(nextTrack);
      nextTrack = chooseRandomNodeInRadiusOf(
        cachedVectorSpace[nextTrack.item_id],
        options.rn,
        options.rg + playlist.length * options.grs,
        cachedEdgeWeights,
        playlist,
      );
    }

    console.log(`Generated playlist:`);
    for (const trackNumber in playlist) {
      const track = playlist[trackNumber];
      const trackNode = cachedVectorSpace[track.item_id];
      console.log(
        `[${trackNumber}] ${trackNode.title} by ${trackNode.author} (to previous: ${
          track.distanceToPrevious.toFixed(2)
        }, to initial: ${track.distanceToInitial.toFixed(2)})`,
      );
    }

    const uploadToJellyfin = await Confirm.prompt({
      message: "Upload this playlist to Jellyfin?",
      default: true,
    });
    if (uploadToJellyfin) {
      const playlistName = await Input.prompt({
        message: "Enter a name for the playlist",
      });
      const playlistsApi = getPlaylistsApi(jellyfin);
      try {
        const playlistCreationResponse = await playlistsApi.createPlaylist({
          createPlaylistDto: {
            Name: playlistName,
            // Ids: playlist.map((track) => track.item_id),
            // MediaType: "Audio",
            // UserId: Deno.env.get("JELLYFIN_USER_ID"),
          },
          name: playlistName,
          //@ts-ignore
          ids: playlist.map((track) => track.item_id).join(","),
          mediaType: "Audio",
          userId: (await kv.get(["jellyfin", "user_id"])).value as string,
        });
        console.log("Playlist created:", playlistCreationResponse.data);
      } catch (err: any) {
        console.error("Error creating playlist:", err?.response?.data);
      }
    }
  });

await new Command()
  .name("audiomuse-mixes")
  .version("0.1.0")
  .description("Better instant mixes for Jellyfin")
  .command("configure", commandConfigure)
  .command("mix", commandMix)
  .command("weights", commandWeights)
  .command("reset", commandReset)
  .reset()
  .action(function () {
    this.showHelp();
  })
  .parse(Deno.args);
