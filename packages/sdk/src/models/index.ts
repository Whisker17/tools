import { ApiPromise } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";
import { hexToString } from "@polkadot/util";
import all from "it-all";
import { concat, toString } from "uint8arrays";

import { MarketId, MarketResponse, ExtendedMarketResponse } from "../types";
import { initIpfs } from "../util";

import Market from "./market";
import Shares from "./shares";

export { Market, Shares };

export default class Models {
  private api: ApiPromise;

  constructor(api: ApiPromise) {
    this.api = api;
  }

  /**
   * Creates a new market with the given parameters.
   * @param signer The signer who will send the transaction.
   * @param title The title of the new prediction market.
   * @param description The description / extra information for the market.
   * @param oracle The address that will be responsible for reporting the market.
   * @param creationType "Permissionless" or "Advised"
   */
  async createNewMarket(
    signer: KeyringPair,
    title: string,
    description: string,
    oracle: string,
    creationType = "Permissionless"
  ): Promise<string> {
    const ipfs = initIpfs();

    const { cid } = await ipfs.add({
      content: `title:${title}::info:${description}`,
    });

    return new Promise(async (resolve) => {
      const unsub = await this.api.tx.predictionMarkets
        .create(oracle, "Binary", 500000, cid.toString(), creationType)
        .signAndSend(signer, (result) => {
          const { events, status } = result;

          if (status.isInBlock) {
            console.log(
              `Transaction included at blockHash ${status.asInBlock}`
            );

            events.forEach(({ phase, event: { data, method, section } }) => {
              console.log(`\t' ${phase}: ${section}.${method}:: ${data}`);

              if (method == "MarketCreated") {
                resolve(data[0].toString());
              }
            });

            unsub();
          }
        });
    });
  }

  async fetchMarketData(marketId: MarketId): Promise<Market> {
    const ipfs = initIpfs();

    const market = (
      await this.api.query.predictionMarkets.markets(marketId)
    ).toJSON() as MarketResponse;

    if (!market) {
      throw new Error(`Market with market id ${marketId} does not exist.`);
    }

    const { metadata } = market;
    const metadataString = hexToString(metadata);

    // Default to no metadata, but actually parse it below if it exists.
    let data = {
      description: "No metadata",
      title: "No metadata",
    };

    // Metadata exists, so parse it.
    if (hexToString(metadata)) {
      const raw = toString(concat(await all(ipfs.cat(metadataString))));

      const extract = (data: string) => {
        const titlePattern = "title:";
        const infoPattern = "::info:";
        return {
          description: data.slice(
            data.indexOf(infoPattern) + infoPattern.length
          ),
          title: data.slice(titlePattern.length, data.indexOf(infoPattern)),
        };
      };

      data = extract(raw);
    }

    //@ts-ignore
    const invalidShareId = await this.api.rpc.predictionMarkets.marketOutcomeShareId(
      marketId,
      0
    );

    //@ts-ignore
    const yesShareId = await this.api.rpc.predictionMarkets.marketOutcomeShareId(
      marketId,
      1
    );

    //@ts-ignore
    const noShareId = await this.api.rpc.predictionMarkets.marketOutcomeShareId(
      marketId,
      2
    );

    Object.assign(market, {
      ...data,
      marketId,
      metadataString,
      invalidShareId: invalidShareId.toString(),
      yesShareId: yesShareId.toString(),
      noShareId: noShareId.toString(),
    });

    return new Market(market as ExtendedMarketResponse, this.api);
  }
}
