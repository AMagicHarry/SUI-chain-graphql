// Import the libraries
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const { request, gql } = require("graphql-request");

// Connect to the Sui chain RPC endpoint
const endpoint = "https://sui-mainnet.mystenlabs.com/graphql";

// Define the CSV file path and header
const csvWriter = createCsvWriter({
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

const validators = [];
const validators_info = [];
const records = [];

const get_validators = gql`
  query Getnodes($after: String, $delegator: String){
    events( after: $after filter: {sender: $delegator}) {
      pageInfo {
        endCursor
        hasNextPage
      }
      nodes {
          json
      }
    }
  } 
`;

const epoch_now = gql`
  query 
  {
    epoch {
      epochId
    }
  }
`

const get_validatorinfo = gql`
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
            votingPower
            commissionRate
          }
        }
      }
    }
  }
`;

//Get Validators from Delegator
async function getNodes(after, delegator) {
  const response = await request(endpoint, get_validators, { after, delegator });
  validators.push(...response.events.nodes);
  if (response.events.pageInfo.hasNextPage) {
    await getNodes(response.events.pageInfo.endCursor, delegator);
  }
  return validators;
}
//Get Total Reward
async function getDelegatorRewards(delegator) {
  const result = await getNodes(null, delegator);
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
  return records;
}
//Get Validator's Details if Validator is in Active Validator's Set
async function getAddressInfo(address, after, id) {
  const response = await request(endpoint, get_validatorinfo, { after, id });
  const activeValidators = response.epoch;
  const specificValidator = activeValidators.validatorSet.activeValidators.nodes.find(
    (validator) => validator.address.address === address
  );
  if (specificValidator) {
    specificValidator.totalStakeRewards = response.epoch.totalStakeRewards;
    specificValidator.totalStake = response.epoch.validatorSet.totalStake;
    specificValidator.id = id;
    specificValidator.active = "active";
    validators_info[id] = specificValidator;
  }
  if (response.epoch.validatorSet.activeValidators.pageInfo.hasNextPage && !specificValidator) {
    await getAddressInfo(address, response.epoch.validatorSet.activeValidators.pageInfo.endCursor, id);
  }
  else {
    return;
  }
}
//Calculate each epoch reward from total reward 

//Speed up when fetch
async function parallel_fetch(index) {
  const batchsize = 1;
  let id = records[index].startepoch;
  let endepoch;
  records[index].endepoch == "-" ? endepoch = current_epoch : endepoch = records[index].endepoch;

  while (id <= endepoch) {
    const batch = [];
    for (let i = 0; i < batchsize && id <= endepoch; i++) {
      batch.push({ after: null, id });
      id++;
    }
    await Promise.all(batch.map(args => getAddressInfo(
      records[index].validator,
      null,
      args.id
    ).then(() => { })))
  }
}

function get_reward_func(stake, end, value) {
  let reward = stake * value[end];
  for (let i = 1; i < end; i++) {
    reward = reward * (1 + value[i])
  }
  return reward;
}

//Get Reward
async function getreward(v_index) {
  const epoch_values = [];
  const validator = records[v_index].validator;
  const epoch = await request(endpoint, epoch_now);
  current_epoch = epoch.epoch.epochId - 1;
  const specific_data = [];
  const rewards = [];

  const csvWriter_validator = createCsvWriter({
    path: "validator(" + validator + v_index + ").csv",
    header: [
      { id: "validator", title: "Validator" },
      { id: "epoch", title: "epoch" },
      { id: "earned", title: "earned" },
      { id: "active", title: "active" },
    ],
  });

  console.log(records[v_index]);
  await parallel_fetch(v_index);

  (async () => {
    validators_info.map((result) => {
      const record = {
        address: result.address.address,
        stakingPoolActivationEpoch: result.stakingPoolActivationEpoch,
        stakingPoolSuiBalance: Number(result.stakingPoolSuiBalance) / 10 ** 9,
        rewardsPool: Number(result.rewardsPool) / 10 ** 9,
        votingPower: Number(result.votingPower) / 10000,
        commissionRate: Number(result.commissionRate) / 10000,
        totalStakeRewards: Number(result.totalStakeRewards) / 10 ** 9,
        totalStake: (Number(result.totalStake) / 10 ** 9),
        active: result.active,
        id: result.id
      }
      specific_data.push(record)
    })
  })();
  (async () => {
    specific_data.map((result) => {
      const epoch_value = (1 - result.commissionRate) * result.totalStakeRewards / result.totalStake;
      epoch_values.push(epoch_value)
    })
  })();
  (async () => {
    specific_data.map((data, index) => {
      const reward = {
        validator: data.address,
        epoch: data.id,
        earned: Number(get_reward_func(records[v_index].suiLocked, index, epoch_values)),
        active: data.active
      }
      rewards.push(reward)
    })
    await csvWriter_validator.writeRecords(rewards);
  })();
}

// Define an async function to write the CSV file
async function writeCSV(delegator) {
  await csvWriter.writeRecords(await getDelegatorRewards(delegator));
  for (let i = 0; i < records.length; i++) {
    await getreward(i);
  }
}

// Call the writeCSV function
writeCSV("0x20cf5fa56a83655a276e37fbe8b067ab04dcfe54119e92ed39461c3d7d0b4665");