import * as cache from "@actions/cache";
import * as core from "@actions/core";

import { Events, Inputs, RefKey } from "../src/constants";
import run from "../src/save-only";
import * as actionUtils from "../src/utils/actionUtils";
import * as testUtils from "../src/utils/testUtils";

jest.mock("@actions/core");
jest.mock("@actions/cache");
jest.mock("../src/utils/actionUtils");

beforeAll(() => {
    jest.spyOn(core, "getInput").mockImplementation((name, options) => {
        return jest.requireActual("@actions/core").getInput(name, options);
    });

    jest.spyOn(actionUtils, "getCacheState").mockImplementation(() => {
        return jest.requireActual("../src/utils/actionUtils").getCacheState();
    });

    jest.spyOn(actionUtils, "getInputAsArray").mockImplementation(
        (name, options) => {
            return jest
                .requireActual("../src/utils/actionUtils")
                .getInputAsArray(name, options);
        }
    );

    jest.spyOn(actionUtils, "getInputAsInt").mockImplementation(
        (name, options) => {
            return jest
                .requireActual("../src/utils/actionUtils")
                .getInputAsInt(name, options);
        }
    );

    jest.spyOn(actionUtils, "isExactKeyMatch").mockImplementation(
        (key, cacheResult) => {
            return jest
                .requireActual("../src/utils/actionUtils")
                .isExactKeyMatch(key, cacheResult);
        }
    );

    jest.spyOn(actionUtils, "isValidEvent").mockImplementation(() => {
        const actualUtils = jest.requireActual("../src/utils/actionUtils");
        return actualUtils.isValidEvent();
    });
});

beforeEach(() => {
    process.env[Events.Key] = Events.Push;
    process.env[RefKey] = "refs/heads/feature-branch";

    jest.spyOn(actionUtils, "isGhes").mockImplementation(() => false);
    jest.spyOn(actionUtils, "isCacheFeatureAvailable").mockImplementation(
        () => true
    );
});

afterEach(() => {
    testUtils.clearInputs();
    delete process.env[Events.Key];
    delete process.env[RefKey];
});

test("save cache when save-only is required", async () => {
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    const savedCacheKey = "Linux-node-";

    jest.spyOn(core, "getInput")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return savedCacheKey;
        })
        // Cache Key
        .mockImplementationOnce(() => {
            return primaryKey;
        });

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Path, inputPath);
    testUtils.setInput(Inputs.UploadChunkSize, "4000000");

    const cacheId = 4;
    const saveCacheMock = jest
        .spyOn(cache, "saveCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(cacheId);
        });

    await run();

    expect(saveCacheMock).toHaveBeenCalledTimes(1);
    expect(saveCacheMock).toHaveBeenCalledWith([inputPath], primaryKey, {
        uploadChunkSize: 4000000
    });

    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save when save on any failure is true", async () => {
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");

    const savedCacheKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    const primaryKey = "Linux-node-";
    const inputPath = "node_modules";

    jest.spyOn(core, "getInput")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return savedCacheKey;
        })
        // Cache Key
        .mockImplementationOnce(() => {
            return primaryKey;
        });

    testUtils.setInput(Inputs.Path, inputPath);
    testUtils.setInput(Inputs.UploadChunkSize, "4000000");
    testUtils.setInput(Inputs.SaveOnAnyFailure, "true");

    const cacheId = 4;
    const saveCacheMock = jest
        .spyOn(cache, "saveCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(cacheId);
        });

    await run();

    expect(saveCacheMock).toHaveBeenCalledTimes(1);
    expect(logWarningMock).toHaveBeenCalledTimes(0);
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with no primary key in input outputs warning", async () => {
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");

    const savedCacheKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return savedCacheKey;
        })
        // Cache Key
        .mockImplementationOnce(() => {
            return "";
        });
    const saveCacheMock = jest.spyOn(cache, "saveCache");

    await run();

    expect(saveCacheMock).toHaveBeenCalledTimes(0);
    expect(logWarningMock).toHaveBeenCalledWith(
        `Error retrieving key from inputs.`
    );
    expect(logWarningMock).toHaveBeenCalledTimes(1);
    expect(failedMock).toHaveBeenCalledTimes(0);
});