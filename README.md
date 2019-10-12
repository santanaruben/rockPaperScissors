# RockPaperScissors Project

RockPaperScissors application for ethereum - Project 3 - Ethereum Developer Course - B9lab Academy

## What:

Alice and Bob play the classic rock paper scissors game.

To enrol, each player needs to deposit the right Ether amount, possibly zero.

To play, each player submits their unique move.

The contract decides and rewards the winner with all Ether wagered.

## Stretch goals

Make it a utility whereby any 2 people can decide to play against each other.

Reduce gas costs as much as you can.

Let players bet their previous winnings.

How can you entice players to play, knowing that they may have their funding stuck in the contract if they faced an uncooperative player?

## Installation

Install [Truffle](https://trufflesuite.com)

Install [MetaMask](https://metamask.io)

Install [ganache](https://github.com/trufflesuite/ganache) running on 127.0.0.1:7545 
or [geth](https://geth.ethereum.org/) to have blockchain access.

Clone or download the repo and use npm to install the required dependencies (jquery, truffle, truffle-contract, web3, webpack, webpack-cli, webpack-dev-server, copy-webpack-plugin).

```bash
npm install
```

## Compile and migrate the contracts

```bash
truffle compile
truffle migrate
```

## Usage from webpack-dev-server

In the app file:

```bash
npm run dev
```

## Build with webpack for production

In the app file:

```bash
npm run build
```

## Test

```bash
truffle test
```
or
```bash
npm run test
```

## Contributing
Pull requests are welcome. Be free to discuss what you would like to change.

## License
[Apache-2.0](https://choosealicense.com/licenses/apache-2.0/)