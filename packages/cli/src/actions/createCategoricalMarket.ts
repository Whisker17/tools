import SDK, { util } from "@zeitgeistpm/sdk";
import {
  CategoryMetadata,
  DecodedMarketMetadata,
  MarketDeadlines,
} from "@zeitgeistpm/sdk/dist/types";

type Options = {
  endpoint: string;
  slug: string;
  description: string;
  oracle: string;
  period: string;
  gracePeriod: string;
  oracleDuration: string;
  disputeDuration: string;
  categories?: string[];
  question: string;
  advised: boolean;
  seed: string;
  timestamp: boolean;
  authorized: string;
  court: boolean;
  cpmm: boolean;
  estimateFee: boolean;
};

const createCategoricalMarket = async (opts: Options): Promise<void> => {
  const {
    slug,
    description,
    oracle,
    period,
    gracePeriod,
    oracleDuration,
    disputeDuration,
    categories,
    advised,
    endpoint,
    seed,
    question,
    timestamp,
    authorized,
    court,
    cpmm,
    estimateFee,
  } = opts;

  const sdk = await SDK.initialize(endpoint);

  const signer = util.signerFromSeed(seed);

  if (!estimateFee) {
    console.log(
      `\x1b[33m%s\x1b[0m`,
      `Sending transaction from ${signer.address}\n`
    );
  }

  if (categories && !(categories.length > 1)) {
    if (categories.length === 1) {
      console.log(`Valid: -c Yes No Maybe`);
      console.log(`Valid: --categories Yes No Maybe`);
      console.log(`Invalid: -categories Yes No Maybe`);
      console.log(`(no space) Invalid: --cYes No Maybe`);
      console.log(`(too few categories) Invalid: --c Inevitably`);
      console.log();
      if (categories[0] === `ategories`) {
        console.log(
          `Did you use the right number of dashes (-c or --categories) ?`
        );
        console.log();
      }
    }
    throw new Error(
      `If specifying categories, at least two must be specified.`
    );
  }

  const categoriesMeta: CategoryMetadata[] =
    categories != null
      ? categories.map((cat) => {
          return { name: cat, ticker: cat.slice(0, 5) };
        })
      : [
          { name: `Yes`, ticker: `YES` },
          { name: `No`, ticker: `NO` },
        ];

  const metadata: DecodedMarketMetadata = {
    description,
    slug,
    question,
    categories: categoriesMeta,
  };

  const marketPeriod = timestamp
    ? { timestamp: period.split(` `).map((x) => +x) }
    : { block: period.split(` `).map((x) => +x) };

  const deadlines: MarketDeadlines = {
    gracePeriod: gracePeriod,
    oracleDuration: oracleDuration,
    disputeDuration: disputeDuration,
  };

  let disputeMechanism = null;
  if (authorized) {
    disputeMechanism = { Authorized: authorized };
  } else {
    disputeMechanism = court ? { Court: null } : { SimpleDisputes: null };
  }

  const res = await sdk.models.createMarket({
    signer,
    oracle,
    period: marketPeriod,
    deadlines,
    metadata,
    creationType: advised ? `Advised` : `Permissionless`,
    marketType: { Categorical: categoriesMeta.length },
    disputeMechanism,
    scoringRule: cpmm ? `CPMM` : `RikiddoSigmoidFeeMarketEma`,
    callbackOrPaymentInfo: estimateFee,
  });

  if (estimateFee) {
    console.log("Fee estimation for transaction", res);
    return;
  }

  if (res && res.length > 0) {
    console.log(`\x1b[36m%s\x1b[0m`, `\ncreateCategoricalMarket successful!`);
  } else {
    console.log(`\x1b[36m%s\x1b[0m`, `\ncreateCategoricalMarket failed!`);
  }
};

export default createCategoricalMarket;
