# Generative bayesian network

NodeJs package containing a bayesian network capable of randomly sampling from a distribution defined by a json object.

<!-- toc -->

- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)

<!-- tocstop -->

## Installation

Run the `npm i generative-bayesian-network` command. No further setup is needed afterwards.

## Usage

To use the network, you need to create an instance of the `BayesianNetwork` class which is exported from this package. Constructor of this class accepts a JSON object containing the network definition. This definition can either include the probability distributions for the nodes, or these can be calculated later using data. An example of such a definition saved in a JSON file could look like:

```json
{
    "nodes": [
        {
            "name": "ParentNode",
            "values": ["A", "B", "C"],
            "parentNames": [],
            "conditionalProbabilities": {
                "A": 0.1,
                "B": 0.8,
                "C": 0.1
            }
        },
        {
            "name": "ChildNode",
            "values": [".", ",", "!", "?"],
            "parentNames": ["ParentNode"],
            "conditionalProbabilities": {
                "A": {
                    ".": 0.7,
                    "!": 0.3
                },
                "B": {
                    ",": 0.3,
                    "?": 0.7
                },
                "C": {
                    ".": 0.5,
                    "?": 0.5
                }
            }
        }
    ]
}
```

Once you have the network definition ready, you can create an instance simply by executing:

```js
let generatorNetwork = new BayesianNetwork({ path: networkDefinitionFilePath });
```

If the network definition didn't include the probabilities, you also need to call the `setProbabilitiesAccordingToData` method and provide it with an array of objects containing the dataset you want to be used to calculate the probabilities:

```js
generatorNetwork.setProbabilitiesAccordingToData(data);
```

After the setup, you can save the current network's definition by doing:

```js
generatorNetwork.saveNetworkDefinition({ path: networkDefinitionFilePath });
```

Once you have the network all set up, you can use two methods to actually generate the samples - `generateSample` and `generateConsistentSampleWhenPossible`. The first one generates a sample of all node values given (optionally) the values we already know in the form of an object. The second does much the same thing, but instead of just getting the known values of some of the attributes, the object you can give it as an argument can contain multiple possible values for each node, not just one. You could run them for example like this:

```js
let sample = generatorNetwork.generateSample({ ParentNode: 'A' });
let consistentSample = generatorNetwork.generateConsistentSampleWhenPossible({
    ParentNode: ['A', 'B'],
    ChildNode: [',', '!'],
});
```

## API Reference

All public classes, methods and their parameters can be inspected in this API reference.

<a name="BayesianNetwork"></a>

### BayesianNetwork

BayesianNetwork is an implementation of a bayesian network capable of randomly sampling from the distribution
represented by the network.

- [BayesianNetwork](#BayesianNetwork)
    - [`new BayesianNetwork(options)`](#new_BayesianNetwork_new)
    - [`.generateSample(inputValues)`](#BayesianNetwork+generateSample)
    - [`.generateConsistentSampleWhenPossible(valuePossibilities)`](#BayesianNetwork+generateConsistentSampleWhenPossible)
    - [`.setProbabilitiesAccordingToData(data)`](#BayesianNetwork+setProbabilitiesAccordingToData)
    - [`.saveNetworkDefinition(options)`](#BayesianNetwork+saveNetworkDefinition)

---

<a name="new_BayesianNetwork_new"></a>

#### `new BayesianNetwork(options)`

| Param   | Type                | Description                                                         |
| ------- | ------------------- | ------------------------------------------------------------------- |
| options | <code>object</code> | `{ path: string }` pointing to a zip file containing the definition |

---

<a name="BayesianNetwork+generateSample"></a>

#### `bayesianNetwork.generateSample(inputValues)`

Randomly samples from the distribution represented by the bayesian network.

| Param       | Type                | Description                        |
| ----------- | ------------------- | ---------------------------------- |
| inputValues | <code>object</code> | node values that are known already |

---

<a name="BayesianNetwork+generateConsistentSampleWhenPossible"></a>

#### `bayesianNetwork.generateConsistentSampleWhenPossible(valuePossibilities)`

Randomly samples from the distribution represented by the bayesian network,
making sure the sample is consistent with the provided restrictions on value possibilities.
Returns false if no such sample can be generated.

| Param              | Type                | Description                                                                                                             |
| ------------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| valuePossibilities | <code>object</code> | a dictionary of lists of possible values for nodes (if a node isn't present in the dictionary, all values are possible) |

---

<a name="BayesianNetwork+setProbabilitiesAccordingToData"></a>

#### `bayesianNetwork.setProbabilitiesAccordingToData(data)`

Sets the conditional probability distributions of this network's nodes to match the given data.

| Param | Type               | Description                         |
| ----- | ------------------ | ----------------------------------- |
| data  | <code>array</code> | an array of records containing data |

---

<a name="BayesianNetwork+saveNetworkDefinition"></a>

#### `bayesianNetwork.saveNetworkDefinition(options)`

Saves the network definition to the specified file path to be used later.

| Param   | Type                | Description                                                         |
| ------- | ------------------- | ------------------------------------------------------------------- |
| options | <code>object</code> | `{ path: string }` specifying where the network definition is saved |

---
