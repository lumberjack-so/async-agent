/**
 * API Client Layer - HTTP Client for Alfred Server
 * Agent 2 implementation - HTTP client for communicating with Alfred server
 */

import axios, { AxiosError } from 'axios';
import {
  AlfredApiClient,
  HealthResponse,
  RunRequest,
  RunResponse,
  ApiError,
} from '../types.js';

const BASE_URL = process.env.ALFRED_URL || 'http://localhost:3001';

export const api: AlfredApiClient = {
  async health(): Promise<HealthResponse> {
    try {
      const response = await axios.get(`${BASE_URL}/health`);
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError && error.code === 'ECONNREFUSED') {
        throw new ApiError(
          'Alfred server is not running. Start it with: npm run dev'
        );
      }

      if (error instanceof AxiosError) {
        const statusCode = error.response?.status;
        const errorMessage = error.response?.data?.message || error.message;
        throw new ApiError(
          `Health check failed: ${errorMessage}`,
          statusCode
        );
      }

      throw new ApiError(
        `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },

  async run(request: RunRequest): Promise<RunResponse> {
    try {
      const response = await axios.post(`${BASE_URL}/webhook`, request);
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError && error.code === 'ECONNREFUSED') {
        throw new ApiError(
          'Alfred server is not running. Start it with: npm run dev'
        );
      }

      if (error instanceof AxiosError) {
        const statusCode = error.response?.status;
        const errorMessage = error.response?.data?.message || error.message;
        throw new ApiError(
          `Request failed: ${errorMessage}`,
          statusCode
        );
      }

      throw new ApiError(
        `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },
};
