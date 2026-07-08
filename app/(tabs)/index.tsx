import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, StatusBar, SafeAreaView, Dimensions, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SHIP_WIDTH = 70;
const SHIP_HEIGHT = 90;
const SHIP_BOTTOM_OFFSET = 130;
const MOVE_STEP = 30;
const ASTEROID_SIZE = 40;
const FALL_SPEED = 5;
const TICK_INTERVAL = 50;
const HIGH_SCORE_KEY = 'SPACE_ESCAPE_HIGH_SCORE';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function getRandomX() {
  return Math.random() * (SCREEN_WIDTH - ASTEROID_SIZE);
}

export default function HomeScreen() {
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [shipPositionValue, setShipPositionValue] = useState(0);
  const [asteroid, setAsteroid] = useState({ x: getRandomX(), y: 0 });
  const [isGameOver, setIsGameOver] = useState(false);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  const shipPositionRef = useRef(0);
  const intervalRef = useRef(null);

  // Animated values create smooth motion instead of instant jumps
  const shipAnim = useRef(new Animated.Value(0)).current;
  const flameAnim = useRef(new Animated.Value(0)).current;
  const asteroidRotation = useRef(new Animated.Value(0)).current;
  const gameOverFade = useRef(new Animated.Value(0)).current;

  // Engine flicker: loops forever, growing and shrinking the flame
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(flameAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(flameAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Asteroid tumble: loops forever, spinning it a full 360°
  useEffect(() => {
    Animated.loop(
      Animated.timing(asteroidRotation, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  useEffect(() => {
    loadHighScore();
  }, []);

  async function loadHighScore() {
    try {
      const savedValue = await AsyncStorage.getItem(HIGH_SCORE_KEY);
      if (savedValue !== null) {
        setHighScore(parseInt(savedValue, 10));
      }
    } catch (error) {
      console.log('Failed to load high score:', error);
    }
  }

  async function saveHighScore(newHighScore) {
    try {
      await AsyncStorage.setItem(HIGH_SCORE_KEY, String(newHighScore));
    } catch (error) {
      console.log('Failed to save high score:', error);
    }
  }

  const maxOffset = SCREEN_WIDTH / 2 - SHIP_WIDTH / 2;

  // Moves the ship smoothly to a new target position using a spring animation
  function animateShipTo(newPosition) {
    shipPositionRef.current = newPosition;
    setShipPositionValue(newPosition);
    Animated.spring(shipAnim, {
      toValue: newPosition,
      useNativeDriver: true,
      speed: 16,
      bounciness: 6,
    }).start();
  }

  const moveLeft = () => {
    if (isGameOver) return;
    const newPosition = Math.max(shipPositionRef.current - MOVE_STEP, -maxOffset);
    animateShipTo(newPosition);
  };

  const moveRight = () => {
    if (isGameOver) return;
    const newPosition = Math.min(shipPositionRef.current + MOVE_STEP, maxOffset);
    animateShipTo(newPosition);
  };

  function checkCollision(asteroidX, asteroidY, currentShipPosition) {
    const shipLeft = SCREEN_WIDTH / 2 - SHIP_WIDTH / 2 + currentShipPosition;
    const shipRight = shipLeft + SHIP_WIDTH;
    const shipTop = SCREEN_HEIGHT - SHIP_BOTTOM_OFFSET - SHIP_HEIGHT;
    const shipBottom = SCREEN_HEIGHT - SHIP_BOTTOM_OFFSET;

    const asteroidLeft = asteroidX;
    const asteroidRight = asteroidX + ASTEROID_SIZE;
    const asteroidTop = asteroidY;
    const asteroidBottom = asteroidY + ASTEROID_SIZE;

    const overlapsHorizontally = asteroidLeft < shipRight && asteroidRight > shipLeft;
    const overlapsVertically = asteroidTop < shipBottom && asteroidBottom > shipTop;

    return overlapsHorizontally && overlapsVertically;
  }

  function handleGameOver(finalScore) {
    setIsGameOver(true);

    gameOverFade.setValue(0);
    Animated.timing(gameOverFade, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    setHighScore((prevHighScore) => {
      if (finalScore > prevHighScore) {
        saveHighScore(finalScore);
        setIsNewHighScore(true);
        return finalScore;
      }
      setIsNewHighScore(false);
      return prevHighScore;
    });
  }

  const restartGame = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setScore(0);
    setIsGameOver(false);
    setIsNewHighScore(false);
    setAsteroid({ x: getRandomX(), y: 0 });
    animateShipTo(0);

    intervalRef.current = setInterval(() => {
      setAsteroid((prevAsteroid) => {
        const newY = prevAsteroid.y + FALL_SPEED;

        const hasCollided = checkCollision(prevAsteroid.x, newY, shipPositionRef.current);

        if (hasCollided) {
          clearInterval(intervalRef.current);
          setScore((currentScore) => {
            handleGameOver(currentScore);
            return currentScore;
          });
          return prevAsteroid;
        }

        if (newY >= SCREEN_HEIGHT) {
          setScore((prevScore) => prevScore + 1);
          return { x: getRandomX(), y: 0 };
        }

        return { ...prevAsteroid, y: newY };
      });
    }, TICK_INTERVAL);
  };

  useEffect(() => {
    restartGame();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Flame scales between 1.0 and 1.4 continuously for a flicker effect
  const flameScale = flameAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.4],
  });

  // Rotation goes from 0deg to 360deg continuously
  const asteroidSpin = asteroidRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Gradient background: deep space navy fading to a lighter purple */}
      <LinearGradient
        colors={['#04050D', '#0B0E1A', '#1A1441']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Some fixed decorative stars scattered around */}
      <View style={styles.starsLayer} pointerEvents="none">
        {STAR_POSITIONS.map((star, index) => (
          <View
            key={index}
            style={[
              styles.star,
              { top: star.top, left: star.left, width: star.size, height: star.size, opacity: star.opacity },
            ]}
          />
        ))}
      </View>

      <Text style={styles.title}>Space Escape Runner</Text>

      <View style={styles.scoresRow}>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>SCORE</Text>
          <Text style={styles.scoreValue}>{score}</Text>
        </View>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>BEST</Text>
          <Text style={styles.highScoreValue}>{highScore}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.startButton} onPress={restartGame} activeOpacity={0.8}>
        <Text style={styles.startButtonText}>Start Game</Text>
      </TouchableOpacity>

      {!isGameOver && (
        <Animated.View
          style={[
            styles.asteroid,
            {
              left: asteroid.x,
              top: asteroid.y,
              transform: [{ rotate: asteroidSpin }],
            },
          ]}
        >
          <View style={styles.craterOne} />
          <View style={styles.craterTwo} />
          <View style={styles.craterThree} />
        </Animated.View>
      )}

      <Animated.View
        style={[
          styles.spaceshipContainer,
          { transform: [{ translateX: shipAnim }] },
        ]}
      >
        <View style={styles.spaceshipNoseOuter} />
        <View style={styles.spaceshipBody}>
          <View style={styles.hullStripe} />
          <View style={styles.cockpitGlow}>
            <View style={styles.cockpit} />
          </View>
        </View>
        <View style={styles.finsRow}>
          <View style={[styles.fin, styles.finLeft]} />
          <View style={[styles.fin, styles.finRight]} />
        </View>
        <View style={styles.flameRow}>
          <Animated.View style={[styles.flameOuter, { transform: [{ scaleY: flameScale }] }]} />
          <Animated.View style={[styles.flameInner, { transform: [{ scaleY: flameScale }] }]} />
        </View>
      </Animated.View>

      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[styles.controlButton, isGameOver && styles.controlButtonDisabled]}
          onPress={moveLeft}
          disabled={isGameOver}
          activeOpacity={0.7}
        >
          <Text style={styles.controlButtonText}>◀</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlButton, isGameOver && styles.controlButtonDisabled]}
          onPress={moveRight}
          disabled={isGameOver}
          activeOpacity={0.7}
        >
          <Text style={styles.controlButtonText}>▶</Text>
        </TouchableOpacity>
      </View>

      {isGameOver && (
        <Animated.View style={[styles.gameOverOverlay, { opacity: gameOverFade }]}>
          <Text style={styles.gameOverText}>GAME OVER</Text>
          {isNewHighScore && <Text style={styles.newBestBadge}>🏆 New Best!</Text>}
          <Text style={styles.finalScoreText}>Score: {score}</Text>
          <Text style={styles.finalHighScoreText}>Best: {highScore}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={restartGame} activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>Play Again</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// Fixed random-ish star positions, generated once outside the component
const STAR_POSITIONS = Array.from({ length: 25 }).map(() => ({
  top: Math.random() * SCREEN_HEIGHT,
  left: Math.random() * SCREEN_WIDTH,
  size: Math.random() * 2 + 1,
  opacity: Math.random() * 0.6 + 0.3,
}));

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  starsLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  star: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  scoresRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 30,
  },
  scoreCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8FA3',
    marginBottom: 4,
    letterSpacing: 1,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#4DD0E1',
  },
  highScoreValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFD54F',
  },
  startButton: {
    backgroundColor: '#4DD0E1',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
    shadowColor: '#4DD0E1',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0B0E1A',
  },

  // ----- Asteroid -----
  asteroid: {
    position: 'absolute',
    width: ASTEROID_SIZE,
    height: ASTEROID_SIZE,
    borderRadius: ASTEROID_SIZE / 2,
    backgroundColor: '#9C7A5C',
    borderWidth: 2,
    borderColor: '#5D4037',
    overflow: 'hidden',
  },
  craterOne: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6D4C2E',
    top: 6,
    left: 8,
  },
  craterTwo: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#6D4C2E',
    top: 20,
    left: 20,
  },
  craterThree: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#6D4C2E',
    top: 10,
    left: 24,
  },

  // ----- Spaceship -----
  spaceshipContainer: {
    position: 'absolute',
    bottom: SHIP_BOTTOM_OFFSET,
    left: '50%',
    marginLeft: -SHIP_WIDTH / 2,
    width: SHIP_WIDTH,
    alignItems: 'center',
  },
  spaceshipNoseOuter: {
    width: 0,
    height: 0,
    borderLeftWidth: SHIP_WIDTH / 4,
    borderRightWidth: SHIP_WIDTH / 4,
    borderBottomWidth: 26,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#F5F5F5',
  },
  spaceshipBody: {
    width: SHIP_WIDTH / 1.8,
    height: 46,
    backgroundColor: '#E8EAF0',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  hullStripe: {
    position: 'absolute',
    bottom: 8,
    width: '100%',
    height: 4,
    backgroundColor: '#FF7043',
  },
  cockpitGlow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(77, 208, 225, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cockpit: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4DD0E1',
  },
  finsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: SHIP_WIDTH,
    marginTop: -10,
  },
  fin: {
    width: 0,
    height: 0,
    borderTopWidth: 20,
    borderTopColor: '#B0BEC5',
  },
  finLeft: {
    borderRightWidth: 16,
    borderRightColor: 'transparent',
  },
  finRight: {
    borderLeftWidth: 16,
    borderLeftColor: 'transparent',
  },
  flameRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  flameOuter: {
    width: 10,
    height: 18,
    borderRadius: 5,
    backgroundColor: '#FF7043',
  },
  flameInner: {
    width: 10,
    height: 18,
    borderRadius: 5,
    backgroundColor: '#FF7043',
  },

  // ----- Controls -----
  controlsRow: {
    position: 'absolute',
    bottom: 30,
    flexDirection: 'row',
    gap: 20,
  },
  controlButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonDisabled: {
    opacity: 0.3,
  },
  controlButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4DD0E1',
  },

  // ----- Game Over overlay -----
  gameOverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4, 5, 13, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameOverText: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FF5252',
    marginBottom: 12,
    letterSpacing: 1,
  },
  newBestBadge: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFD54F',
    marginBottom: 16,
  },
  finalScoreText: {
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  finalHighScoreText: {
    fontSize: 16,
    color: '#FFD54F',
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: '#4DD0E1',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
    shadowColor: '#4DD0E1',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0B0E1A',
  },
});