import {ApplicationService} from '@themost/common';

export declare class RedisCacheStrategy extends ApplicationService {
    add(key: string, value: any, absoluteExpiration?: number): Promise<any>;

    clear(): Promise<any>;

    get(key: string): Promise<any>;

    getOrDefault(key: string, fn: Promise<any>, absoluteExpiration?: number): Promise<any>;

    remove(key: string): Promise<any>;

}