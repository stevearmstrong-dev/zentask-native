import React from 'react';
import { Image } from 'react-native';

interface Props {
  size?: number;
}

export default function GoogleLogo({ size = 20 }: Props) {
  return (
    <Image
      source={require('../assets/google-logo.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}
