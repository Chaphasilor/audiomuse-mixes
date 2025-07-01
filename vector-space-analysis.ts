import { KV_DB_PATH } from "./constants.ts";
import { parseVector } from "./parsing.ts";
import { weights } from "./vector-weights.ts";
import seedrandom from "npm:seedrandom";

const kv = await Deno.openKv(KV_DB_PATH);
const rng = seedrandom(
  (await kv.get(["randomseed"])).value as string ?? `helloworld`,
);

export async function parseVectorSpace(
  jsonData: RawNode[],
  cachePath: string,
): Promise<VectorSpace> {
  const vectorSpace = (await Promise.all(jsonData.map(async (item: RawNode) => {
    const moodVector = parseVector<MoodVector>(item[`mood_vector`]);
    const otherFeaturesVector = parseVector<OtherFeaturesVector>(
      item[`other_features`],
    );
    return {
      ...item,
      mood_vector: moodVector,
      other_features: otherFeaturesVector,
    };
  }))).reduce(
    (
      acc: Record<ParsedNode[`item_id`], ParsedNode>,
      curr: ParsedNode,
    ) => {
      acc[curr.item_id] = curr;
      return acc;
    },
    {},
  );

  await Deno.writeTextFile(cachePath, JSON.stringify(vectorSpace, null, 2));

  return vectorSpace;
}

export async function calculateEdgeWeights(
  vectorSpace: VectorSpace,
  cachePath: string,
): Promise<EdgeWeights> {
  const edges: Record<
    ParsedNode[`item_id`],
    Record<ParsedNode[`item_id`], number>
  > = {};

  for (const [nodeA, vectorA] of Object.entries(vectorSpace)) {
    edges[nodeA] = {};
    for (const [nodeB, vectorB] of Object.entries(vectorSpace)) {
      if (nodeA !== nodeB) {
        const combinedVectorA = createWeightedVector(vectorA);
        const combinedVectorB = createWeightedVector(vectorB);
        const distance = Object.keys(combinedVectorA).reduce((sum, key) => {
          const valueA = combinedVectorA[key] ?? 0;
          const valueB = combinedVectorB[key] ?? 0;
          return sum + Math.pow(valueA - valueB, 2);
        }, 0);
        edges[nodeA][nodeB] = Math.sqrt(distance);
      }
    }
  }

  await Deno.writeTextFile(cachePath, JSON.stringify(edges, null, 2));

  return edges;
}

export function chooseRandomNodeInRadiusOf(
  currentNode: ParsedNode,
  radiusNext: number,
  radiusGlobal: number,
  edgeWeights: Record<
    ParsedNode[`item_id`],
    Record<ParsedNode[`item_id`], number>
  >,
  currentPlaylist: Array<PlaylistItem>,
): PlaylistItem | null {
  const potentialNodes = Object.entries(edgeWeights[currentNode.item_id])
    .filter((
      [toNode],
    ) => !currentPlaylist.some((track) => track.item_id === toNode));
  let filteredNodes = potentialNodes.filter((
    [toNode, distance],
  ) =>
    distance <= radiusNext &&
    edgeWeights[currentPlaylist[0].item_id][toNode] <= radiusGlobal // ensure the next node is within the global radius of the initial track
  );
  console.log(`local results:`, filteredNodes.length);
  // fall back to searching in a different "direction" within radiusNext of the initial track
  if (filteredNodes.length === 0) {
    filteredNodes = Object.entries(edgeWeights[currentPlaylist[0].item_id])
      .filter((
        [toNode, distance],
      ) =>
        distance <= radiusNext &&
        !currentPlaylist.some((track) => track.item_id === toNode)
      );
    console.log(`global results:`, filteredNodes.length);
  }
  // if no other "direction" has unvisited nodes within radiusNext fall back to tracks within radiusGlobal of the initial track
  if (filteredNodes.length === 0) {
    filteredNodes = Object.entries(edgeWeights[currentPlaylist[0].item_id])
      .filter((
        [toNode, distance],
      ) =>
        distance <= radiusGlobal &&
        !currentPlaylist.some((track) => track.item_id === toNode)
      );
    console.log(`global results:`, filteredNodes.length);
  }

  const chosenItem = filteredNodes[Math.floor(rng() * filteredNodes.length)]
    ?.[0];

  return chosenItem
    ? {
      item_id: chosenItem,
      distanceToPrevious: edgeWeights[currentNode.item_id][chosenItem],
      distanceToInitial: edgeWeights[currentPlaylist[0].item_id][chosenItem],
    }
    : null;
}

function createWeightedVector(node: ParsedNode): Record<string, number> {
  return {
    energy: node.energy * weights.energy,
    ...Object.entries(node.mood_vector).reduce(
      (acc, [key, value]) => {
        acc[key as MoodVectorKey] = value *
          (weights.mood_vector[key as MoodVectorKey] || 1.0);
        return acc;
      },
      {} as Record<MoodVectorKey, number>,
    ),
    ...Object.entries(node.other_features).reduce(
      (acc, [feature, value]) => {
        acc[`other_${feature}`] = value *
          weights.other_features[feature as OtherFeaturesVectorKey];
        return acc;
      },
      {} as Record<string, number>,
    ),
  };
}
