// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "hardhat/console.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "./PhatRollupAnchor.sol";

contract EvmClient is Ownable, AccessControl, PhatRollupAnchor {

	constructor(address _address)
		Ownable(_address)
	{
		_grantRole(DEFAULT_ADMIN_ROLE, _address);
	}

	// register a new attestor
	function registerAttestor(address _attestor) public virtual onlyRole(DEFAULT_ADMIN_ROLE){
		grantRole(PhatRollupAnchor.ATTESTOR_ROLE, _attestor);
	}

	function pushMessage(bytes memory data) external onlyRole(DEFAULT_ADMIN_ROLE) {
		_pushMessage(data);
	}

	function _onMessageReceived(bytes calldata _action) internal override {

	}

}