export default {
  name: 'ties-slurs',
  group: 'api',
  description: 'ties (same pitch) and slurs (across pitches)',
  song: {
    voices: [
      {
        id: 'ties',
        clef: 'treble',
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C5', length: '1/4', tie: 'start' },
          { pitch: 'C5', length: '1/4', tie: 'continue' },
          { pitch: 'C5', length: '1/4', tie: 'stop' },
          { pitch: 'D5', length: '1/4' },
          { pitch: 'E5', length: '1/4', tie: 'start' },
          { pitch: 'E5', length: '1/2', tie: 'stop' },
          { pitch: 'F5', length: '1/4' },
        ],
      },
      {
        id: 'slurs',
        clef: 'treble',
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C5', length: '1/8', slur: 'start' },
          { pitch: 'D5', length: '1/8' },
          { pitch: 'E5', length: '1/8' },
          { pitch: 'F5', length: '1/8', slur: 'stop' },
          { pitch: 'G5', length: '1/4', slur: 'start' },
          { pitch: 'A5', length: '1/4' },
          { pitch: 'B5', length: '1/4' },
          { pitch: 'C6', length: '1/4', slur: 'stop' },
        ],
      },
    ],
  },
};
