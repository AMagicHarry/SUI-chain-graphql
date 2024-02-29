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
    { id: "startepoch", title: "Start Epoch" },
    { id: "endepoch", title: "End Epoch" },
    { id: "suiEarned", title: "SUI Earned" },
    { id: "suiLocked", title: "SUI Locked" },
  ],
});
const csvWriter1 = createCsvWriter({
  path: "validator_rewords.csv",
  header: [
    { id: "address", title: "Address" },
    { id: "name", title: "Name" },
    { id: "stakingPoolActivationEpoch", title: "stakingPoolActivationEpoch" },
    { id: "stakingPoolSuiBalance", title: "stakingPoolSuiBalance" },
    { id: "rewardsPool", title: "rewardsPool" },
    { id: "votingPower", title: "votingPower" },
    { id: "commissionRate", title: "commissionRate" },
    { id: "exchangeRatesSize", title: "exchangeRatesSize" },
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

  // const query = gql`
  // query Getnodes($after: String){
  //   events( after: $after filter: {sender:"0x571bad7fd728af0fb5589888e8124214467ae3ba7947cff39dea9d0638e5979a"}) {
  //     pageInfo {
  //       startCursor
  //       endCursor
  //       hasNextPage
  //       hasPreviousPage
  //     }
  //     nodes {
  //         json
  //         timestamp
  //     }
  //   }
  // } 
  // `;

  // const nodes = [];
  // const records = [];

  // async function getNodes(after) {
  //   const response = await request(endpoint, query, { after });
  //   nodes.push(...response.events.nodes);
  //   // console.log(nodes)
  //   if (response.events.pageInfo.hasNextPage) {
  //     // console.log(response.events.pageInfo.hasNextPage)
  //     await getNodes(response.events.pageInfo.endCursor);
  //   }

  //   return nodes;
  // }

  // (async () => {
  //   const result = await getNodes(null);
  //   // console.log(result);
  //   result.map((result) => {
  //     if (result.json.reward_amount) {
  //       const record = {
  //         address: result.json.staker_address,
  //         validator: result.json.validator_address,
  //         startepoch: result.json.stake_activation_epoch,
  //         endepoch: result.json.unstaking_epoch,
  //         suiEarned: Number(result.json.reward_amount) / 10 ** 9,
  //         suiLocked: Number(result.json.principal_amount) / 10 ** 9,
  //       }
  //       records.push(record)
  //     }
  //     else {
  //       const record = {
  //         address: result.json.staker_address,
  //         validator: result.json.validator_address,
  //         startepoch: result.json.epoch,
  //         endepoch: "-",
  //         suiEarned: "-",
  //         suiLocked: Number(result.json.amount) / 10 ** 9,
  //       }
  //       records.push(record)
  //       console.log(records);
  //     }
  //   })
  //   records.sort(compare);

  //   csvWriter.writeRecords(records);
  // })();


  // return records;



  const query = gql`
  query getnode($after: String, $id: Int) 
  {
    epoch(id:$id){
    validatorSet{
      activeValidators(after: $after) {
        pageInfo {
          endCursor
          hasNextPage
        }
        nodes {
          address {
            address
          }
          name
          stakingPoolActivationEpoch
          stakingPoolSuiBalance
          rewardsPool
          votingPower
          commissionRate
          exchangeRatesSize
        }
      }
    }
  }
}


  `;

  const nodes = [];

  async function getAddressInfo(address, after, id) {
    console.log(id)
    if (id == 10) {
      return nodes;
    }
    const response = await request(endpoint, query, { after, id });
    const activeValidators = response.epoch.validatorSet.activeValidators.nodes;
    const specificValidator = activeValidators.find(
      (validator) => validator.address.address === address
    );
    if (specificValidator) {
      // Do something with the validator object that has the specific address
      console.log(specificValidator);
      //nodes.push(specificValidator)
      nodes[id] = specificValidator;
    }
    //if (id < 10) {
    if (response.epoch.validatorSet.activeValidators.pageInfo.hasNextPage && !specificValidator) {
      await getAddressInfo(address, response.epoch.validatorSet.activeValidators.pageInfo.endCursor, id);
    }
    else {
      return;
    }
    //else await getAddressInfo(address, null, id + 1);
    //}
  }
  const batchsize = 3;
  let id = 0;
  while (id < 300) {
    const batch = [];
    for (let i = 0; i < batchsize && id < 300; i++) {
      batch.push({ after: null, id });
      id++;
    }
    await Promise.all(batch.map(args => getAddressInfo(
      "0xf7abab51fdf9b4626ce706a5dfbb3da13a715700149bc816dfbee2ae73d61be5",
      null,
      args.id
    ).then(() => { })))
  }
  console.log(nodes);
}

// Define an async function to write the CSV file
async function writeCSV() {
  console.log("Writing CSV file...");
  const data = await getDelegatorRewards();
  // await csvWriter.writeRecords(data);

  // Log a success message
  console.log("CSV file written successfully");
}

// Call the writeCSV function
writeCSV();













// nodes.map((node) => {
//   const record = {
//     address: delegator,
//     validator: result.validatorAddress,
//     epoch: result.stakes[0].stakeActiveEpoch,
//     suiEarned: Number(result.stakes[0].estimatedReward) / 10 ** 9,
//     suiLocked: Number(result.stakes[0].principal) / 10 ** 9,
//   };
//   records.push(record);
//   console.log(records);
// });

// const response = await request(endpoint, query);
// console.log(response.events.nodes);



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