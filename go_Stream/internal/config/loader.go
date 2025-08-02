package config

import (
"fmt"
"os"
"gopkg.in/yaml.v3"
)

type ConfigLoader struct{}

func NewConfigLoader() *ConfigLoader {
return &ConfigLoader{}
}

func (cl *ConfigLoader) LoadConfig(filename string) (*Config, error) {
data, err := os.ReadFile(filename)
if err != nil {
return nil, fmt.Errorf("failed to read config file %s: %w", filename, err)
}

var config Config
if err := yaml.Unmarshal(data, &config); err != nil {
return nil, fmt.Errorf("failed to unmarshal config: %w", err)
}

if config.Redis.Host == "" {
config.Redis.Host = "localhost"
}
if config.Redis.Port == 0 {
config.Redis.Port = 6379
}

return &config, nil
}

func (c *Config) GetRedisAddress() string {
return fmt.Sprintf("%s:%d", c.Redis.Host, c.Redis.Port)
}

func (c *Config) GetRedisDatabase() int {
return c.Redis.DB
}
