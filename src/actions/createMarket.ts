import { initIpfs } from "../util/ipfs";
import { initApi, signerFromSeed } from "../util/polkadot";

type Options = {
  title: string
  info: string;
  oracle: string;
  seed: string;
};

const createMarket = async (opts: Options) => {
  const { title, info, oracle, seed } = opts;

  const api = await initApi();
  const ipfs = initIpfs();

  const { cid } = await ipfs.add({
    content: `title:${title}::info:${info}`,
  });

  const signer = signerFromSeed(seed);

  console.log("sending from", signer.address);

  const unsub = await api.tx.predictionMarkets.create(
    oracle,
    "Binary",
    3,
    10000,
    cid.toString(),
    "Permissionless",
  ).signAndSend(signer, (result) => {
    const { events, status } = result;

    if (status.isInBlock) {
      console.log(`Transaction included at blockHash ${status.asInBlock}`);
    } else if (status.isFinalized) {
      console.log(`Transaction finalized at blockHash ${status.asFinalized}`);
      
      events.forEach(({ phase, event: { data, method, section } }) => {
        console.log(`\t' ${phase}: ${section}.${method}:: ${data}`);
      });

      unsub();
      process.exit(0);
    }
  });
}

export default createMarket;
