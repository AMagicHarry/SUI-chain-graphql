// Import the libraries
const { Web3 } = require("web3");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const { request, gql } = require("graphql-request");

// Connect to the Sui chain RPC endpoint
const web3 = new Web3("https://fullnode.mainnet.sui.io:443");
const endpoint = "https://sui-mainnet.mystenlabs.com/graphql";

// Define the delegator address
const delegator =
  "0x571bad7fd728af0fb5589888e8124214467ae3ba7947cff39dea9d0638e5979a";

// Define the CSV file path and header
const csvWriter1 = createCsvWriter({
  path: "delegator_rewards(total).csv",
  header: [
    { id: "address", title: "Address" },
    { id: "validator", title: "Validator" },
    { id: "startepoch", title: "Start Epoch" },
    { id: "endepoch", title: "End Epoch" },
    { id: "suiEarned", title: "SUI Earned" },
    { id: "suiLocked", title: "SUI Locked" },
  ],
});

const csvWriter2 = createCsvWriter({
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

const records = [];

const epoch_now = gql`
  query 
  {
    epoch {
      epochId
    }
  }
`

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

const query1 = gql`
  query getnode($after: String, $id: Int) 
  {
    epoch(id:$id){
      totalStakeRewards
      validatorSet{
        totalStake
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

async function getDelegatorRewards() {
  const nodes = [];

  async function getNodes(after) {
    const response = await request(endpoint, query, { after });
    nodes.push(...response.events.nodes);
    if (response.events.pageInfo.hasNextPage) {
      await getNodes(response.events.pageInfo.endCursor);
    }
    return nodes;
  }

  const result = await getNodes(null);

  result.map((result) => {
    if (result.json.reward_amount) {
      const record = {
        address: result.json.staker_address,
        validator: result.json.validator_address,
        startepoch: Number(result.json.stake_activation_epoch),
        endepoch: Number(result.json.unstaking_epoch),
        suiEarned: Number(result.json.reward_amount) / 10 ** 9,
        suiLocked: Number(result.json.principal_amount) / 10 ** 9,
      };
      records.push(record);
    } else {
      const record = {
        address: result.json.staker_address,
        validator: result.json.validator_address,
        startepoch: Number(result.json.epoch),
        endepoch: "-",
        suiEarned: "-",
        suiLocked: Number(result.json.amount) / 10 ** 9,
      };
      records.push(record);
    }
  });

  records.sort(compare);
  return records;
}

//Get Reward
async function getreward() {
  const epoch = await request(endpoint, epoch_now);
  current_epoch = epoch.epoch.epochId - 1;

  console.log(records[10]);
  // console.log(records[10])
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
      specificValidator.totalStake = response.epoch.validatorSet.totalStake;
      //nodes.push(specificValidator)
      nodess[id] = specificValidator;
      console.log(id)
    }

    if (response.epoch.validatorSet.activeValidators.pageInfo.hasNextPage && !specificValidator) {
      await getAddressInfo(address, response.epoch.validatorSet.activeValidators.pageInfo.endCursor, id);
    }
    else {
      return;
    }
  }

  const batchsize = 3;
  let id = records[10].startepoch;
  let endepoch;
  records[10].endepoch == "-" ? endepoch = current_epoch : endepoch = records[10].endepoch;
  // console.log(endepoch)
  while (id <= endepoch) {
    const batch = [];
    for (let i = 0;  i < batchsize && id <= endepoch; i++) {
      batch.push({ after: null, id });
      id++;
    }
    await Promise.all(batch.map(args => getAddressInfo(
      records[10].validator,
      null,
      args.id
    ).then(() => { })))
  }
  // console.log(nodess)
  const recordss = [];
  (async () => {
    nodess.map((result) => {
      const record = {
        address: result.address.address,
        stakingPoolActivationEpoch: result.stakingPoolActivationEpoch,
        stakingPoolSuiBalance: Number(result.stakingPoolSuiBalance) / 10 ** 9,
        rewardsPool: Number(result.rewardsPool) / 10 ** 9,
        votingPower: Number(result.votingPower) / 10000,
        commissionRate: Number(result.commissionRate) / 10000,
        totalStakeRewards: Number(result.totalStakeRewards) / 10 ** 9,
        totalStake: (Number(result.totalStake) / 10 ** 9) 
      }
      recordss.push(record)
      console.log(record)
    })
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

  function get_reward(stake, end) {
    let reward = stake * epoch_values[end];
    for (let i = 1; i < end; i++) {
      reward = reward * (1 + epoch_values[i])
    }
    return reward;
  }

  console.log("Start");
  (async () => {
    for (let i = 0; i < epoch_values.length; i++) {
      const record = {
        validator: records[10].validator,
        epoch: records[10].startepoch + i,
        earned: Number(get_reward(records[10].suiLocked, i)),
      }
      rewards.push(record)
      console.log(rewards)
    }
    await csvWriter2.writeRecords(rewards);
  })();
  console.log("End")
}

// Define an async function to write the CSV file
async function writeCSV() {
  console.log("Writing CSV file...");
  await csvWriter1.writeRecords(await getDelegatorRewards());
  console.log("CSV file (Get Total Reward) written successfully");
  await getreward();
}

// Call the writeCSV function
writeCSV();