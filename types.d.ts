// {
//   "item_id": "38d99d82cb1f58d1536b2af98368bd50",
//   "title": "Nothing`s Gonna Stop Me Now",
//   "author": "Paul Kaye",
//   "tempo": 109.981155,
//   "key": "B",
//   "scale": "minor",
//   "mood_vector": "rock:0.000,pop:0.000,alternative:0.000,indie:0.000,electronic:0.000",
//   "energy": 0.03291903,
//   "other_features": "danceable:0.00,aggressive:0.00,happy:0.00,party:0.00,relaxed:0.00,sad:0.00"
// }

type PlaylistItem = {
  item_id: ParsedNode[`item_id`];
  distanceToPrevious: number;
  distanceToInitial: number;
};

type VectorSpace = Record<ParsedNode[`item_id`], ParsedNode>;

type EdgeWeights = Record<
  ParsedNode[`item_id`],
  Record<ParsedNode[`item_id`], number>
>;

type RawNode = {
  item_id: string;
  title: string;
  author: string;
  tempo: number;
  key: string;
  scale: string;
  mood_vector: string;
  energy: number;
  other_features: string;
};

type ParsedNode = {
  item_id: string;
  title: string;
  author: string;
  tempo: number;
  key: string;
  scale: string;
  mood_vector: MoodVector;
  energy: number;
  other_features: OtherFeaturesVector;
};

// [`rock`, `pop`, `alternative`, `indie`, `electronic`, `female vocalists`, `dance`, `00s`, `alternative rock`, `jazz`,`beautiful`, `metal`, `chillout`, `male vocalists`, `classic rock`, `soul`, `indie rock`, `Mellow`, `electronica`, `80s`,`folk`, `90s`, `chill`, `instrumental`, `punk`, `oldies`, `blues`, `hard rock`, `ambient`, `acoustic`, `experimental`,`female vocalist`, `guitar`, `Hip-Hop`, `70s`, `party`, `country`, `easy listening`, `sexy`, `catchy`, `funk`, `electro`,`heavy metal`, `Progressive rock`, `60s`, `rnb`, `indie pop`, `sad`, `House`, `happy`]
type MoodVectorKey =
  | "rock"
  | "pop"
  | "alternative"
  | "indie"
  | "electronic"
  | "female vocalists"
  | "dance"
  | "00s"
  | "alternative rock"
  | "jazz"
  | "beautiful"
  | "metal"
  | "chillout"
  | "male vocalists"
  | "classic rock"
  | "soul"
  | "indie rock"
  | "Mellow"
  | "electronica"
  | "80s"
  | "folk"
  | "90s"
  | "chill"
  | "instrumental"
  | "punk"
  | "oldies"
  | "blues"
  | "hard rock"
  | "ambient"
  | "acoustic"
  | "experimental"
  | "female vocalist"
  | "guitar"
  | "Hip-Hop"
  | "70s"
  | "party"
  | "country"
  | "easy listening"
  | "sexy"
  | "catchy"
  | "funk"
  | "electro"
  | "heavy metal"
  | "Progressive rock"
  | "60s"
  | "rnb"
  | "indie pop"
  | "sad"
  | "House"
  | "happy";
type MoodVector = {
  [key in MoodVectorKey]?: number;
};

// ['danceable', 'aggressive', 'happy', 'party', 'relaxed', 'sad']
type OtherFeaturesVectorKey =
  | "danceable"
  | "aggressive"
  | "happy"
  | "party"
  | "relaxed"
  | "sad";
type OtherFeaturesVector = {
  [key in OtherFeaturesVectorKey]?: number;
};
