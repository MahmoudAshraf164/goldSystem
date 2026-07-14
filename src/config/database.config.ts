import { MongooseModuleOptions } from '@nestjs/mongoose';

export function getDatabaseConfig(uri: string): MongooseModuleOptions {
  return {
    uri,
    // Required for MongoDB Atlas TLS
    tls: true,
    tlsAllowInvalidCertificates: false,

    // Serverless-safe timeouts — fail fast, not silent hangs
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,

    // Pool: reuse connections across warm Vercel invocations
    // minPoolSize: 0 so idle connections don't keep the function alive
    maxPoolSize: 10,
    minPoolSize: 0,

    // Never buffer — surface connection errors immediately
    bufferCommands: false,

    // Heartbeat keeps Atlas connection alive between requests
    heartbeatFrequencyMS: 30000,
  };
}
