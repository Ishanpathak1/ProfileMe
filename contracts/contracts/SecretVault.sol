// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SecretVault {
    event SecretStored(address indexed sender, string secret);

    function storeSecret(string memory _secret) external {
        emit SecretStored(msg.sender, _secret);
    }
}

