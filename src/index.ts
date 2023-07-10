// Imports
// ========================================================
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import {
  core,
  defaultEthConnectionConfig,
  CredentialStorage,
  EthConnectionConfig,
  EthStateStorage,
  IDataStorage,
  Identity,
  IdentityStorage,
  InMemoryDataSource,
  InMemoryMerkleTreeStorage,
  Profile,
  W3CCredential,
  CredentialWallet,
  ICredentialWallet,
  IIdentityWallet,
  InMemoryPrivateKeyStore,
  BjjProvider,
  KMS,
  KmsKeyType,
  IdentityWallet,
  CredentialStatusType,
  CredentialRequest,
  CredentialStatusResolverRegistry,
  IssuerResolver,
  RHSResolver,
} from "@0xpolygonid/js-sdk";

// Config
// ========================================================
config();

// Functions
// ========================================================
/**
 *
 * @returns
 */
const initDataStorage = (): IDataStorage => {
  const conf: EthConnectionConfig = {
    ...defaultEthConnectionConfig,
    contractAddress: `${process.env.CONTRACT_ADDRESS}`,
    url: `${process.env.RPC_URL}`,
  };

  const dataStorage = {
    credential: new CredentialStorage(new InMemoryDataSource<W3CCredential>()),
    identity: new IdentityStorage(
      new InMemoryDataSource<Identity>(),
      new InMemoryDataSource<Profile>()
    ),
    mt: new InMemoryMerkleTreeStorage(40),

    states: new EthStateStorage(conf),
  };

  return dataStorage;
};

/**
 *
 * @param dataStorage
 * @param credentialWallet
 * @returns
 */
const initIdentityWallet = async (
  dataStorage: IDataStorage,
  credentialWallet: ICredentialWallet
): Promise<IIdentityWallet> => {
  const memoryKeyStore = new InMemoryPrivateKeyStore();
  const bjjProvider = new BjjProvider(KmsKeyType.BabyJubJub, memoryKeyStore);
  const kms = new KMS();
  // Do I store these keys somewhere?
  kms.registerKeyProvider(KmsKeyType.BabyJubJub, bjjProvider);
  return new IdentityWallet(kms, dataStorage, credentialWallet);
};

(async () => {
  // Setup - Create ID
  // ========================================================
  console.group("Setup\n========================================================");
  const dataStorage = initDataStorage();
  // console.log({ dataStorage });
  // const credentialWallet = new CredentialWallet(dataStorage); //await initCredetialWallet(dataStorage);
  const statusRegistry = new CredentialStatusResolverRegistry();
  statusRegistry.register(
    CredentialStatusType.SparseMerkleTreeProof,
    new IssuerResolver()
  );
  statusRegistry.register(
    CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
    new RHSResolver(dataStorage.states)
  );
  const credentialWallet = new CredentialWallet(dataStorage, statusRegistry);


  // console.log({ credentialWallet });
  const identityWallet = await initIdentityWallet(
    dataStorage,
    credentialWallet
  );
  // console.log({ identityWallet });

  // Generate ID
  const issuerWallet = await identityWallet.createIdentity({
    method: core.DidMethod.Iden3, // core.DidMethod.PolygonId
    blockchain: core.Blockchain.Polygon,
    networkId: core.NetworkId.Mumbai, // core.NetworkId.Main,
    // seed: seedPhraseIssuer,
    revocationOpts: {
      type: CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
      id: `${process.env.RHS_URL}`,
    },
  });

  const receiverWallet = await identityWallet.createIdentity({
    method: core.DidMethod.Iden3, // core.DidMethod.PolygonId
    blockchain: core.Blockchain.Polygon,
    networkId: core.NetworkId.Mumbai, // core.NetworkId.Main,
    // seed: seedPhraseIssuer,
    revocationOpts: {
      type: CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
      id: `${process.env.RHS_URL}`,
    },
  });

  // // Issuer Auth DID
  // await fs.writeFileSync(
  //   path.join(__dirname, "../data", "issuerID.json"),
  //   JSON.stringify(issuerWallet.did, null, 2)
  // );
  // // Issuer Auth BabyJubJub Credential
  // await fs.writeFileSync(
  //   path.join(__dirname, "../data", "issuerCredential.json"),
  //   JSON.stringify(issuerWallet.credential, null, 2)
  // );
  // // Receiver Auth DID
  // await fs.writeFileSync(
  //   path.join(__dirname, "../data", "receiverID.json"),
  //   JSON.stringify(receiverWallet.did, null, 2)
  // );
  // // Receiver Auth BabyJubJub Credential
  // await fs.writeFileSync(
  //   path.join(__dirname, "../data", "receiverCredential.json"),
  //   JSON.stringify(receiverWallet.credential, null, 2)
  // );
  // console.groupEnd();

  // Issue Credential
  // ========================================================
  console.group("Issue Credential\n========================================================");
  const credentialRequest: CredentialRequest = {
    credentialSchema:
      "https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json/KYCAgeCredential-v3.json",
    type: "KYCAgeCredential",
    credentialSubject: {
      id: receiverWallet.did.toString(),
      birthday: 19960424,
      documentType: 99,
    },
    expiration: 12345678888,
    revocationOpts: {
      type: CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
      id: `${process.env.RHS_URL}`,
    },
  };

  const credential = await identityWallet.issueCredential(
    issuerWallet.did,
    credentialRequest,
  );
  console.log({ credential });
  // console.groupEnd();
})();
