import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  size?: number;
}

export default function GoogleLogo({ size = 20 }: Props) {
  // Using logo-google icon from Ionicons as a replacement for the Google logo PNG
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="logo-google" size={size} color="#4285F4" />
    </View>
  );
}
