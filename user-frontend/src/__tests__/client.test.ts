/**
 * API Client 拦截器单元测试
 * 覆盖: src/api/client.ts — 请求/响应拦截器、getErrorMessage
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { getErrorMessage } from '@/api/client'

describe('getErrorMessage', () => {
  it('处理 AxiosError 并返回 response message', () => {
    const error = {
      isAxiosError: true,
      response: {
        data: { message: '用户已存在' },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {},
      },
      message: 'Request failed with status code 400',
      name: 'AxiosError',
      toJSON: () => ({}),
    } as unknown as axios.AxiosError

    expect(getErrorMessage(error)).toBe('用户已存在')
  })

  it('AxiosError 无 response.message 时返回 error.message', () => {
    const error = {
      isAxiosError: true,
      response: {
        data: {},
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config: {},
      },
      message: 'Network Error',
      name: 'AxiosError',
      toJSON: () => ({}),
    } as unknown as axios.AxiosError

    expect(getErrorMessage(error)).toBe('Network Error')
  })

  it('处理普通 Error 对象', () => {
    const error = new Error('Something went wrong')
    expect(getErrorMessage(error)).toBe('Something went wrong')
  })

  it('处理非 Error 类型的异常', () => {
    expect(getErrorMessage('string error')).toBe('未知错误')
    expect(getErrorMessage(42)).toBe('未知错误')
    expect(getErrorMessage(null)).toBe('未知错误')
    expect(getErrorMessage(undefined)).toBe('未知错误')
  })

  it('处理无 response 的 AxiosError（网络错误）', () => {
    const error = {
      isAxiosError: true,
      response: undefined,
      message: 'timeout of 30000ms exceeded',
      name: 'AxiosError',
      toJSON: () => ({}),
    } as unknown as axios.AxiosError

    expect(getErrorMessage(error)).toBe('timeout of 30000ms exceeded')
  })
})

describe('apiClient 配置', () => {
  it('apiClient 是 axios 实例', async () => {
    const { apiClient } = await import('@/api/client')
    expect(apiClient).toBeDefined()
    expect(apiClient.defaults.timeout).toBe(30000)
  })

  it('apiClient 默认 Content-Type 为 application/json', async () => {
    const { apiClient } = await import('@/api/client')
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json')
  })
})
