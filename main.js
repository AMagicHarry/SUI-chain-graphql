// Import the libraries
const { Web3 } = require("web3");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const { request, gql } = require("graphql-request");

// Connect to the Sui chain RPC endpoint
const web3 = new Web3("https://fullnode.mainnet.sui.io:443");

// Define the delegator address
const delegator =
  "0x571bad7fd728af0fb5589888e8124214467ae3ba7947cff39dea9d0638e5979a";

// Define the CSV file path and header
const csvWriter = createCsvWriter({
  path: "delegator_rewards.csv",
  header: [
    { id: "address", title: "Address" },
    { id: "validator", title: "Validator" },
    { id: "epoch", title: "Epoch" },
    { id: "suiEarned", title: "SUI Earned" },
    { id: "suiLocked", title: "SUI Locked" },
  ],
});

function compare(a, b) {
  if (a.validator < b.validator) {
    return -1;
  }
  if (a.validator > b.validator) {
    return 1;
  }
  return 0;
}

async function getDelegatorRewards() {
  const endpoint = "https://sui-mainnet.mystenlabs.com/graphql";

  const query = gql`
  query {
    events(first:10 filter: {sender:"0x571bad7fd728af0fb5589888e8124214467ae3ba7947cff39dea9d0638e5979a"}) {
      nodes {
          json
          timestamp
      }
    }
  }
  
  `;

  const variables = {
    epochID: 100,
  };
  const response = await request(endpoint, query);
  console.log(response.events.nodes);

  // const data = {
  //   jsonrpc: "2.0",
  //   id: 1,
  //   method: "suix_getStakes",
  //   params: [
  //     "0x571bad7fd728af0fb5589888e8124214467ae3ba7947cff39dea9d0638e5979a",
  //   ],
  // };

  // const records = [];
  // const result = await new Promise((resolve, reject) => {
  //   web3.currentProvider.send(data, (error, result) => {
  //     if (error) {
  //       console.error(error);
  //       reject(error);
  //     } else {
  //       // console.log(result);
  //       result.result.map((result) => {
  //         const record = {
  //           address: delegator,
  //           validator: result.validatorAddress,
  //           epoch: result.stakes[0].stakeActiveEpoch,
  //           suiEarned: Number(result.stakes[0].estimatedReward) / 10 ** 9,
  //           suiLocked: Number(result.stakes[0].principal) / 10 ** 9,
  //         };
  //         records.push(record);
  //         console.log(records);
  //       });
  //       resolve(result);
  //     }
  //   });
  // });

  // records.sort(compare);

  // return records;
}

// Define an async function to write the CSV file
async function writeCSV() {
  // console.log("Writing CSV file...");
  const data = await getDelegatorRewards();
  // await csvWriter.writeRecords(data);

  // Log a success message
  // console.log("CSV file written successfully");
}

// Call the writeCSV function
writeCSV();
