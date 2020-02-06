import axiosStatic, { AxiosInstance } from 'axios';
import { AccountsService } from "./accountsService";
import { ApiAuthService } from "./apiAuthService";
import { CallflowsService } from "./callflowsService";
import { CallInspectorService } from "./callInspectorService";
import { CdrsService } from "./cdrsService";
import { UsersService } from "./usersService";

export interface CrossbarConfig {
    baseURL: string;
    accountId: string;
    pvtApiKey?: string;
    authToken?: string;
};

const defaultCrossbarConfig: CrossbarConfig = {
    baseURL: "",
    accountId: "",
};

export class Crossbar {
    axios: AxiosInstance;
    config: CrossbarConfig;

    readonly accountsService: AccountsService;
    readonly apiAuthService: ApiAuthService;
    readonly callflowsService: CallflowsService;
    readonly callInspectorService: CallInspectorService;
    readonly cdrsService: CdrsService;
    readonly usersService: UsersService;

    constructor(config?: Partial<CrossbarConfig>) {
        this.config = { ...defaultCrossbarConfig, ...config };
        this.axios = axiosStatic.create({
            baseURL: `${this.config.baseURL}/accounts/${this.config.accountId}`,
            withCredentials: true
        });

        if (this.config.pvtApiKey && !this.config.authToken) {
            const authPutData = { data: { api_key: this.config.pvtApiKey } };
            const authPutConfig = { ...this.axios.defaults, baseURL: this.config.baseURL };
            this.axios.put('/api_auth', authPutData, authPutConfig).then(authResponse => {
                this.config.authToken = authResponse.data.auth_token;
                this.setAxiosInterceptors();
            }).catch(authErr => {
                return Promise.reject(authErr);
            });
        } else {
            this.setAxiosInterceptors();
        }

        this.accountsService = new AccountsService(this);
        this.apiAuthService = new ApiAuthService(this);
        this.callflowsService = new CallflowsService(this);
        this.callInspectorService = new CallInspectorService(this);
        this.cdrsService = new CdrsService(this);
        this.usersService = new UsersService(this);
    }

    setAxiosInterceptors() {
        this.axios.interceptors.request.use(async config => {
            if (this.config.authToken != null && this.config.authToken != '') {
                config.headers['X-Auth-Token'] = this.config.authToken
            }
            return config;
        });

        this.axios.interceptors.response.use(response => response, async error => {
            let errResponse = error.response;
            if (errResponse.status === 401 && this.config.pvtApiKey) {
                const authPutData = { data: { api_key: this.config.pvtApiKey } };
                const authPutConfig = { ...this.axios.defaults, baseURL: this.config.baseURL };
                return this.axios.put('/api_auth', authPutData, authPutConfig).then(authResponse => {
                    this.config.authToken = authResponse.data.auth_token;
                    this.setAxiosInterceptors();
                    errResponse.config.headers['X-Auth-Token'] = this.config.authToken;
                    return this.axios(errResponse.config);
                }).catch(authErr => {
                    return Promise.reject(authErr);
                });
            } else {
                return error;
            }
        });
    }
}