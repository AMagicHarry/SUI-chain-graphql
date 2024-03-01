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
// const csvWriter = createCsvWriter({
//   path: "delegator_rewards.csv",
//   header: [
//     { id: "address", title: "Address" },
//     { id: "validator", title: "Validator" },
//     { id: "startepoch", title: "Start Epoch" },
//     { id: "endepoch", title: "End Epoch" },
//     { id: "suiEarned", title: "SUI Earned" },
//     { id: "suiLocked", title: "SUI Locked" },
//   ],
// });
// const csvWriter1 = createCsvWriter({
//   path: "validator_rewords.csv",
//   header: [
//     { id: "address", title: "Address" },
//     { id: "name", title: "Name" },
//     { id: "stakingPoolActivationEpoch", title: "stakingPoolActivationEpoch" },
//     { id: "stakingPoolSuiBalance", title: "stakingPoolSuiBalance" },
//     { id: "rewardsPool", title: "rewardsPool" },
//     { id: "votingPower", title: "votingPower" },
//     { id: "commissionRate", title: "commissionRate" },
//     { id: "exchangeRatesSize", title: "exchangeRatesSize" },
//     { id: "totalStakeRewards", title: "totalStakeRewards" },
//     { id: "totalStake", title: "totalStake" },
//   ],
// });
const csvWriter = createCsvWriter({
  path: "delegator_rewards.csv",
  header: [
    { id: "validator", title: "Validator" },
    { id: "epoch", title: "epoch" },
    { id: "earned", title: "earned" },
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
  query Getnodes($after: String){
    events( after: $after filter: {sender:"0x571bad7fd728af0fb5589888e8124214467ae3ba7947cff39dea9d0638e5979a"}) {
      pageInfo {
        startCursor
        endCursor
        hasNextPage
        hasPreviousPage
      }
      nodes {
          json
          timestamp
      }
    }
  } 
  `;
  //   const query1 = gql`
  //   query getnode($after: String, $id: Int) 
  //   {
  //     epoch(id:$id){
  //       totalStakeRewards
  //     validatorSet{
  //       activeValidators(after: $after) {
  //         pageInfo {
  //           endCursor
  //           hasNextPage
  //         }
  //         nodes {
  //           address {
  //             address
  //           }
  //           name
  //           stakingPoolActivationEpoch
  //           stakingPoolSuiBalance
  //           rewardsPool
  //           votingPower
  //           commissionRate
  //           exchangeRatesSize
  //         }
  //       }
  //     }
  //   }
  // }
  //   `;
  const query1 = gql`
  query getnode($after: String, $id: Int) 
  {
    epoch(id:$id){
      totalStakeRewards
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
          stakingPoolActivationEpoch
          stakingPoolSuiBalance
          rewardsPool
          votingPower
          commissionRate
        }
      }
    }
  }
}
  `;

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
  //         startepoch: Number(result.json.stake_activation_epoch),
  //         endepoch: Number(result.json.unstaking_epoch),
  //         suiEarned: Number(result.json.reward_amount) / 10 ** 9,
  //         suiLocked: Number(result.json.principal_amount) / 10 ** 9,
  //       }
  //       records.push(record)
  //     }
  //     else {
  //       const record = {
  //         address: result.json.staker_address,
  //         validator: result.json.validator_address,
  //         startepoch: Number(result.json.epoch),
  //         endepoch: "-",
  //         suiEarned: "-",
  //         suiLocked: Number(result.json.amount) / 10 ** 9,
  //       }
  //       records.push(record)
  //     }
  //   })
  //   records.sort(compare);
  //   console.log(records)
  //   // csvWriter.writeRecords(records);
  // })();

  const nodess = [];

  async function getAddressInfo(address, after, id) {
    const response = await request(endpoint, query1, { after, id });
    const activeValidators = response.epoch;
    const specificValidator = activeValidators.validatorSet.activeValidators.nodes.find(
      (validator) => validator.address.address === address
    );
    if (specificValidator) {
      // Do something with the validator object that has the specific address
      specificValidator.totalStakeRewards = response.epoch.totalStakeRewards;
      //nodes.push(specificValidator)
      nodess[id] = specificValidator;
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
  while (id < 140) {
    const batch = [];
    for (let i = 0; i < batchsize && id < 140; i++) {
      batch.push({ after: null, id });
      id++;
    }
    await Promise.all(batch.map(args => getAddressInfo(
      "0xefa5f0435f230579dc95f219a1a8929f91b98cba727d7c1de8b10738be431ade",
      null,
      args.id
    ).then(() => { })))
  }

  const recordss = [];
  (async () => {
    nodess.map((result) => {
      const record = {
        address: result.address.address,
        // name: result.name,
        stakingPoolActivationEpoch: result.stakingPoolActivationEpoch,
        stakingPoolSuiBalance: Number(result.stakingPoolSuiBalance) / 10 ** 9,
        rewardsPool: Number(result.rewardsPool) / 10 ** 9,
        votingPower: Number(result.votingPower) / 10000,
        commissionRate: Number(result.commissionRate) / 10000,
        // exchangeRatesSize: result.exchangeRatesSize,
        totalStakeRewards: Number(result.totalStakeRewards) / 10 ** 9,
        totalStake: (Number(result.stakingPoolSuiBalance) / 10 ** 9) / (Number(result.votingPower) / 10000),
      }
      recordss.push(record)
    })
    csvWriter.writeRecords(recordss);

  })();

  const epoch_values = [];
  (async () => {
    recordss.map((result) => {
      const epoch_value = (1 - result.commissionRate) * result.totalStakeRewards / result.totalStake;
      epoch_values.push(epoch_value)
    })
    console.log(epoch_values)
  })();

  const rewards = [];

  function get_reward(stake, start, end) {
    let reward = stake * epoch_values[start + end];
    console.log(epoch_values[start + end], "sssssssss")
    for (let i = start; i < start + end; i++) {
      reward = reward * (1 + epoch_values[i])
      console.log(epoch_values[i])
    }
    return reward;
  }

  (async () => {
    for (let i = 1; i < epoch_values.length; i++) {
      console.log(get_reward(2400000, 0, i), "@@@")
      const record = {
        validator: "0xefa5f0435f230579dc95f219a1a8929f91b98cba727d7c1de8b10738be431ade",
        epoch: i,
        earned: Number(get_reward(2400000, 0, i)),
      }
      rewards.push(record)
      // console.log(get_reward(300000000, i, epoch_values.length))
    }
    await csvWriter.writeRecords(rewards);
    // console.log(rewards)
  })();
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