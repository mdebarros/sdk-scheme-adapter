/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2019 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       James Bush - james.bush@modusbox.com                             *
 **************************************************************************/

'use strict';


// load default local environment vars
//require('dotenv').config({path: 'local.env'});

// we use a mock standard components lib to intercept and mock certain funcs
jest.mock('@mojaloop/sdk-standard-components');


const { init, destroy, setConfig, getConfig } = require('../../config.js');
const util = require('util');
const path = require('path');
const MockCache = require('../../__mocks__/cache.js');
const { Logger, Transports } = require('@internal/log');
const Model = require('@internal/model').outboundTransfersModel;

let logTransports;


// dummy environment config
const config = {
    INBOUND_LISTEN_PORT: '4000',
    OUTBOUND_LISTEN_PORT: '4001',
    MUTUAL_TLS_ENABLED: 'false',
    VALIDATE_INBOUND_JWS: 'true',
    JWS_SIGN: 'true',
    JWS_SIGNING_KEY_PATH: '/jwsSigningKey.key',
    JWS_VERIFICATION_KEYS_DIRECTORY: '/jwsVerificationKeys',
    IN_CA_CERT_PATH: './secrets/cacert.pem',
    IN_SERVER_CERT_PATH: './secrets/servercert.pem',
    IN_SERVER_KEY_PATH: './secrets/serverkey.pem',
    OUT_CA_CERT_PATH: './secrets/cacert.pem',
    OUT_CLIENT_CERT_PATH: './secrets/servercert.pem',
    OUT_CLIENT_KEY_PATH: './secrets/serverkey.pem',
    LOG_INDENT: '0',
    CACHE_HOST: '172.17.0.2',
    CACHE_PORT: '6379',
    PEER_ENDPOINT: '172.17.0.3:4000',
    BACKEND_ENDPOINT: '172.17.0.5:4000',
    DFSP_ID: 'mojaloop-sdk',
    ILP_SECRET: 'Quaixohyaesahju3thivuiChai5cahng',
    EXPIRY_SECONDS: '60',
    AUTO_ACCEPT_QUOTES: 'false',
    AUTO_ACCEPT_PARTY: 'false',
    CHECK_ILP: 'true',
    ENABLE_TEST_FEATURES: 'false',
    WS02_BEARER_TOKEN: '7718fa9b-be13-3fe7-87f0-a12cf1628168',
    OAUTH_TOKEN_ENDPOINT: '',
    OAUTH_CLIENT_KEY: '',
    OAUTH_CLIENT_SECRET: '',
    OAUTH_REFRESH_SECONDS: '3600'
};


// a dummy transfer request
const transferRequest = {
    "from": {
        "displayName": "James Bush",
        "idType": "MSISDN",
        "idValue": "447710066017"
    },
    "to": {
        "idType": "MSISDN",
        "idValue": "123456789"
    },
    "amountType": "SEND",
    "currency": "USD",
    "amount": "100",
    "transactionType": "TRANSFER",
    "note": "test payment",
    "homeTransactionId": "123ABC"
};


// a dummy payee party
const payeeParty = {
    "party": {
        "partyIdInfo": {
            "partyIdType": "MSISDN",
            "partyIdentifier": "123456789",
            "fspId": "MobileMoney"
        },
        "personalInfo": {
            "complexName": {
                "firstName": "John",
                "lastName": "Doe"
            }
        }
    }
};


// a dummy quote response
const quoteResponse = {
    "type": "quoteResponse",
    "data": {
        "transferAmount": {
            "amount": "500",
            "currency": "USD"
        },
        "payeeReceiveAmount": {
            "amount": "490",
            "currency": "USD"
        },
        "payeeFspFee": {
            "amount": "5",
            "currency": "USD"
        },
        "payeeFspCommission": {
            "amount": "5",
            "currency": "USD"
        },
        "geoCode": {
            "latitude": "53.295971",
            "longitude": "-0.038500"
        },
        "expiration": "2017-11-15T14:17:09.663+01:00",
        "ilpPacket": "AQAAAAAAACasIWcuc2UubW9iaWxlbW9uZXkubXNpc2RuLjEyMzQ1Njc4OYIEIXsNCiAgICAidHJhbnNhY3Rpb25JZCI6ICI4NWZlYWMyZi0zOWIyLTQ5MWItODE3ZS00YTAzMjAzZDRmMTQiLA0KICAgICJxdW90ZUlkIjogIjdjMjNlODBjLWQwNzgtNDA3Ny04MjYzLTJjMDQ3ODc2ZmNmNiIsDQogICAgInBheWVlIjogew0KICAgICAgICAicGFydHlJZEluZm8iOiB7DQogICAgICAgICAgICAicGFydHlJZFR5cGUiOiAiTVNJU0ROIiwNCiAgICAgICAgICAgICJwYXJ0eUlkZW50aWZpZXIiOiAiMTIzNDU2Nzg5IiwNCiAgICAgICAgICAgICJmc3BJZCI6ICJNb2JpbGVNb25leSINCiAgICAgICAgfSwNCiAgICAgICAgInBlcnNvbmFsSW5mbyI6IHsNCiAgICAgICAgICAgICJjb21wbGV4TmFtZSI6IHsNCiAgICAgICAgICAgICAgICAiZmlyc3ROYW1lIjogIkhlbnJpayIsDQogICAgICAgICAgICAgICAgImxhc3ROYW1lIjogIkthcmxzc29uIg0KICAgICAgICAgICAgfQ0KICAgICAgICB9DQogICAgfSwNCiAgICAicGF5ZXIiOiB7DQogICAgICAgICJwZXJzb25hbEluZm8iOiB7DQogICAgICAgICAgICAiY29tcGxleE5hbWUiOiB7DQogICAgICAgICAgICAgICAgImZpcnN0TmFtZSI6ICJNYXRzIiwNCiAgICAgICAgICAgICAgICAibGFzdE5hbWUiOiAiSGFnbWFuIg0KICAgICAgICAgICAgfQ0KICAgICAgICB9LA0KICAgICAgICAicGFydHlJZEluZm8iOiB7DQogICAgICAgICAgICAicGFydHlJZFR5cGUiOiAiSUJBTiIsDQogICAgICAgICAgICAicGFydHlJZGVudGlmaWVyIjogIlNFNDU1MDAwMDAwMDA1ODM5ODI1NzQ2NiIsDQogICAgICAgICAgICAiZnNwSWQiOiAiQmFua05yT25lIg0KICAgICAgICB9DQogICAgfSwNCiAgICAiYW1vdW50Ijogew0KICAgICAgICAiYW1vdW50IjogIjEwMCIsDQogICAgICAgICJjdXJyZW5jeSI6ICJVU0QiDQogICAgfSwNCiAgICAidHJhbnNhY3Rpb25UeXBlIjogew0KICAgICAgICAic2NlbmFyaW8iOiAiVFJBTlNGRVIiLA0KICAgICAgICAiaW5pdGlhdG9yIjogIlBBWUVSIiwNCiAgICAgICAgImluaXRpYXRvclR5cGUiOiAiQ09OU1VNRVIiDQogICAgfSwNCiAgICAibm90ZSI6ICJGcm9tIE1hdHMiDQp9DQo\u003d\u003d",
        "condition": "fH9pAYDQbmoZLPbvv3CSW2RfjU4jvM4ApG_fqGnR7Xs"
    }
};


// a dummy transfer fulfilment
const transferFulfil = {
    "type": "transferFulfil",
    "data": {
        "fulfilment": "87mm1-reS3SAi8oIWXgBkLmgWc1MkZ_yLbFDX5XAdo5o",
        "completedTimestamp": "2017-11-15T14:16:09.663+01:00",
        "transferState": "COMMITTED"
    }
};


describe('outboundModel', () => {
    // the keys are under the "secrets" folder that is supposed to be moved by Dockerfile
    // so for the needs of the unit tests, we have to define the proper path manually.
    config.JWS_SIGNING_KEY_PATH = path.join('..', 'secrets', config.JWS_SIGNING_KEY_PATH);
    config.JWS_VERIFICATION_KEYS_DIRECTORY = path.join('..', 'secrets', config.JWS_VERIFICATION_KEYS_DIRECTORY);

    beforeAll(async () => {
        logTransports = await Promise.all([Transports.consoleDir()]);
    });

    afterEach(async () => {
    });


    test('initializes to starting state', async () => {
        init();

        await setConfig(config);
        const conf = getConfig();

        const model = new Model({
            cache: new MockCache(),
            logger: new Logger({ context: { app: 'outbound-model-unit-tests' }, space:4, transports:logTransports }),
            ...conf
        });

        await model.initialize(JSON.parse(JSON.stringify(transferRequest)));

        expect(model.stateMachine.state).toBe('start');

        //we have to destroy the file system watcher or we will leave an async handle open
        destroy();
        console.log('config destroyed');
    });


    test('executes all three transfer stages without halting when AUTO_ACCEPT_PARTY and AUTO_ACCEPT_QUOTES are true', async () => {
        init();
        config.AUTO_ACCEPT_PARTY = 'true';
        config.AUTO_ACCEPT_QUOTES = 'true';

        await setConfig(config);
        const conf = getConfig();

        const model = new Model({
            cache: new MockCache(),
            logger: new Logger({ context: { app: 'outbound-model-unit-tests' }, space:4, transports:logTransports }),
            ...conf
        });

        await model.initialize(JSON.parse(JSON.stringify(transferRequest)));

        expect(model.stateMachine.state).toBe('start');

        model.requests.on('getParties', () => {
            // simulate a callback with the resolved party
            model.cache.emitMessage(JSON.stringify(payeeParty));
        });

        model.requests.on('postQuotes', () => {
            // simulate a callback with the quote response
            model.cache.emitMessage(JSON.stringify(quoteResponse));
        });

        model.requests.on('postTransfers', () => {
            // simulate a callback with the trnasfer fulfilment
            model.cache.emitMessage(JSON.stringify(transferFulfil));
        });

        // start the model running
        const resultPromise = model.run(); 

        // wait for the model to reach a terminal state
        const result = await resultPromise;

        console.log(`Result after three stage transfer: ${util.inspect(result)}`);

        // check we stopped at payeeResolved state
        expect(result.currentState).toBe('COMPLETED');
        expect(model.stateMachine.state).toBe('succeeded');

        //we have to destroy the file system watcher or we will leave an async handle open
        destroy();
        console.log('config destroyed');
    });


    test('resolves payee and halts when AUTO_ACCEPT_PARTY is false', async () => {
        init();
        config.AUTO_ACCEPT_PARTY = 'false';

        await setConfig(config);
        const conf = getConfig();

        const model = new Model({
            cache: new MockCache(),
            logger: new Logger({ context: { app: 'outbound-model-unit-tests' }, space:4, transports:logTransports }),
            ...conf
        });

        await model.initialize(JSON.parse(JSON.stringify(transferRequest)));

        expect(model.stateMachine.state).toBe('start');

        // start the model running
        const resultPromise = model.run(); 

        // now we started the model running we simulate a callback with the resolved party
        model.cache.emitMessage(JSON.stringify(payeeParty));

        // wait for the model to reach a terminal state
        const result = await resultPromise;

        console.log(`Result after resolve payee: ${util.inspect(result)}`);

        // check we stopped at payeeResolved state
        expect(result.currentState).toBe('WAITING_FOR_PARTY_ACCEPTANCE');
        expect(model.stateMachine.state).toBe('payeeResolved');

        //we have to destroy the file system watcher or we will leave an async handle open
        destroy();
        console.log('config destroyed');
    });


    test('halts after resolving payee, resumes and then halts after receiving quote response when AUTO_ACCEPT_PARTY is false and AUTO_ACCEPT_QUOTES is false', async () => {
        init();
        config.AUTO_ACCEPT_PARTY = 'false';
        config.AUTO_ACCEPT_QUOTES = 'false';

        await setConfig(config);
        const conf = getConfig();

        const cache = new MockCache();

        let model = new Model({
            cache: cache,
            logger: new Logger({ context: { app: 'outbound-model-unit-tests' }, space:4, transports:logTransports }),
            ...conf
        });

        await model.initialize(JSON.parse(JSON.stringify(transferRequest)));

        expect(model.stateMachine.state).toBe('start');

        // start the model running
        let resultPromise = model.run(); 

        // now we started the model running we simulate a callback with the resolved party
        model.cache.emitMessage(JSON.stringify(payeeParty));

        // wait for the model to reach a terminal state
        let result = await resultPromise;

        console.log(`Result after resolve payee: ${util.inspect(result)}`);

        // check we stopped at payeeResolved state
        expect(result.currentState).toBe('WAITING_FOR_PARTY_ACCEPTANCE');
        expect(model.stateMachine.state).toBe('payeeResolved');

        const transferId = result.transferId;

        // check the model saved itself to the cache
        expect(model.cache.data[`transferModel_${transferId}`]).toBeTruthy();

        // load a new model from the saved state
        model = new Model({
            cache: cache,
            logger: new Logger({ context: { app: 'outbound-model-unit-tests' }, space:4, transports:logTransports }),
            ...conf
        });

        await model.load(transferId);

        // check the model loaded to the correct state
        expect(model.stateMachine.state).toBe('payeeResolved');

        // now run the model again. this should trigger transition to quote request
        resultPromise = model.run();

        // now we started the model running we simulate a callback with the quote response
        model.cache.emitMessage(JSON.stringify(quoteResponse));

        // wait for the model to reach a terminal state
        result = await resultPromise;

        console.log(`Result after request quote: ${util.inspect(result)}`);

        // check we stopped at payeeResolved state
        expect(result.currentState).toBe('WAITING_FOR_QUOTE_ACCEPTANCE');
        expect(model.stateMachine.state).toBe('quoteReceived');

        //we have to destroy the file system watcher or we will leave an async handle open
        destroy();
        console.log('config destroyed');
    });


    test('halts and resumes after parties and quotes stages when AUTO_ACCEPT_PARTY is false and AUTO_ACCEPT_QUOTES is false', async () => {
        init();
        config.AUTO_ACCEPT_PARTY = 'false';
        config.AUTO_ACCEPT_QUOTES = 'false';

        await setConfig(config);
        const conf = getConfig();

        const cache = new MockCache();

        let model = new Model({
            cache: cache,
            logger: new Logger({ context: { app: 'outbound-model-unit-tests' }, space:4, transports:logTransports }),
            ...conf
        });

        await model.initialize(JSON.parse(JSON.stringify(transferRequest)));

        expect(model.stateMachine.state).toBe('start');

        // start the model running
        let resultPromise = model.run(); 

        // now we started the model running we simulate a callback with the resolved party
        model.cache.emitMessage(JSON.stringify(payeeParty));

        // wait for the model to reach a terminal state
        let result = await resultPromise;

        console.log(`Result after resolve payee: ${util.inspect(result)}`);

        // check we stopped at payeeResolved state
        expect(result.currentState).toBe('WAITING_FOR_PARTY_ACCEPTANCE');
        expect(model.stateMachine.state).toBe('payeeResolved');

        const transferId = result.transferId;

        // check the model saved itself to the cache
        expect(model.cache.data[`transferModel_${transferId}`]).toBeTruthy();

        // load a new model from the saved state
        model = new Model({
            cache: cache,
            logger: new Logger({ context: { app: 'outbound-model-unit-tests' }, space:4, transports:logTransports }),
            ...conf
        });

        await model.load(transferId);

        // check the model loaded to the correct state
        expect(model.stateMachine.state).toBe('payeeResolved');

        // now run the model again. this should trigger transition to quote request
        resultPromise = model.run();

        // now we started the model running we simulate a callback with the quote response
        model.cache.emitMessage(JSON.stringify(quoteResponse));

        // wait for the model to reach a terminal state
        result = await resultPromise;

        console.log(`Result after request quote: ${util.inspect(result)}`);

        // check we stopped at quoteReceived state
        expect(result.currentState).toBe('WAITING_FOR_QUOTE_ACCEPTANCE');
        expect(model.stateMachine.state).toBe('quoteReceived');

        // load a new model from the saved state
        model = new Model({
            cache: cache,
            logger: new Logger({ context: { app: 'outbound-model-unit-tests' }, space:4, transports:logTransports }),
            ...conf
        });

        await model.load(transferId);

        // check the model loaded to the correct state
        expect(model.stateMachine.state).toBe('quoteReceived');

        // now run the model again. this should trigger transition to quote request
        resultPromise = model.run();

        // now we started the model running we simulate a callback with the transfer fulfilment
        model.cache.emitMessage(JSON.stringify(transferFulfil));

        // wait for the model to reach a terminal state
        result = await resultPromise;

        console.log(`Result after transfer fulfil: ${util.inspect(result)}`);

        // check we stopped at quoteReceived state
        expect(result.currentState).toBe('COMPLETED');
        expect(model.stateMachine.state).toBe('succeeded');

        //we have to destroy the file system watcher or we will leave an async handle open
        destroy();
        console.log('config destroyed');
    });

});
