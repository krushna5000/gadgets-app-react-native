import {
  View,
  Text,
  StyleSheet,
  Alert,
  Platform,
  TouchableOpacity,
  FlatList,
  Image,
} from 'react-native';
import { useCartStore } from '../store/cart-store';
import { StatusBar } from 'expo-status-bar';
import { createOrder, createOrderItem } from '../api/api';
import { openStripeCheckout, setupStripePaymentSheet } from '../lib/stripe';
import { useAuth } from '../providers/auth-provider';
import { useRouter } from 'expo-router';

type CartItemType = {
  id: number;
  title: string;
  heroImage: string;
  price: number;
  quantity: number;
  maxQuantity: number;
};

type CartItemProps = {
  item: CartItemType;
  onRemove: (id: number) => void;
  onIncrement: (id: number) => void;
  onDecrement: (id: number) => void;
};

const CartItem = ({
  item,
  onDecrement,
  onIncrement,
  onRemove,
}: CartItemProps) => {
  return (
    <View style={styles.cartItem}>
      <Image source={{ uri: item.heroImage }} style={styles.itemImage} />
      <View style={styles.itemDetails}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
        <View style={styles.quantityContainer}>
          <TouchableOpacity
            onPress={() => onDecrement(item.id)}
            style={styles.quantityButton}
          >
            <Text style={styles.quantityButtonText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.itemQuantity}>{item.quantity}</Text>
          <TouchableOpacity
            onPress={() => onIncrement(item.id)}
            style={styles.quantityButton}
          >
            <Text style={styles.quantityButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => onRemove(item.id)}
        style={styles.removeButton}
      >
        <Text style={styles.removeButtonText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function Cart() {
  const router = useRouter();
  const { user, mounting } = useAuth();
  const {
    items,
    removeItem,
    incrementItem,
    decrementItem,
    getTotalPrice,
    resetCart,
  } = useCartStore();

  const { mutateAsync: createSupabaseOrder } = createOrder();
  const { mutateAsync: createSupabaseOrderItem } = createOrderItem();

  const isCartEmpty = items.length === 0;

  const handleCheckout = async () => {
    // Early return if not authenticated
    if (!user || !user.id) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to proceed with checkout',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/signin') }
        ]
      );
      return;
    }

    if (isCartEmpty) {
      Alert.alert('Cart Empty', 'Please add items to your cart before checking out.');
      return;
    }

    const totalPrice = parseFloat(getTotalPrice());

    try {
      // Setup Stripe payment
      await setupStripePaymentSheet(Math.floor(totalPrice * 100));
      const result = await openStripeCheckout();

      if (!result) {
        Alert.alert('Payment Failed', 'The payment process was not completed.');
        return;
      }

      // Create order
      let orderData;
      try {
        orderData = await createSupabaseOrder({ totalPrice });
      } catch (orderError: any) {
        if (orderError.message.includes('authenticated')) {
          Alert.alert('Session Expired', 'Please sign in again to complete your purchase.');
          router.push('/signin');
        } else {
          Alert.alert('Order Creation Failed', 'Unable to create your order. Please try again.');
        }
        return;
      }

      if (!orderData || !orderData.id) {
        Alert.alert('Order Creation Failed', 'Unable to create your order. Please try again.');
        return;
      }

      // Create order items
      try {
        const orderItems = items.map(item => ({
          orderId: orderData.id,
          productId: item.id,
          quantity: item.quantity,
        }));

        await createSupabaseOrderItem(orderItems);
        Alert.alert('Success', 'Order created successfully');
        resetCart();
      } catch (orderItemError) {
        console.error('Error creating order items:', orderItemError);
        Alert.alert(
          'Order Items Creation Failed',
          'Your payment was processed but we encountered an error saving your order items. Our team will contact you to resolve this.'
        );
      }
    } catch (error) {
      console.error('Checkout error:', error);
      Alert.alert(
        'Checkout Error',
        'An unexpected error occurred. Please try again or contact support if the problem persists.'
      );
    }
  };

  // Show loading state while auth is being checked
  if (mounting) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />

      {isCartEmpty ? (
        <View style={styles.emptyCartContainer}>
          <Text style={styles.emptyCartText}>Your cart is empty</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <CartItem
              item={item}
              onRemove={removeItem}
              onIncrement={incrementItem}
              onDecrement={decrementItem}
            />
          )}
          contentContainerStyle={styles.cartList}
        />
      )}

      <View style={styles.footer}>
        <Text style={styles.totalText}>Total: ${getTotalPrice()}</Text>
        <TouchableOpacity
          onPress={handleCheckout}
          style={[
            styles.checkoutButton,
            (isCartEmpty || !user) && styles.checkoutButtonDisabled
          ]}
          disabled={isCartEmpty || !user}
        >
          <Text style={styles.checkoutButtonText}>
            {user ? 'Checkout' : 'Sign In to Checkout'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  cartList: {
    paddingVertical: 16,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  itemDetails: {
    flex: 1,
    marginLeft: 16,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    color: '#888',
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 14,
    color: '#666',
  },
  removeButton: {
    padding: 8,
    backgroundColor: '#ff5252',
    borderRadius: 8,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  footer: {
    borderTopWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  checkoutButton: {
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
    backgroundColor: '#ddd',
    marginHorizontal: 5,
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyCartContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCartText: {
    fontSize: 18,
    color: '#666',
  },
  checkoutButtonDisabled: {
    backgroundColor: '#cccccc',
    opacity: 0.7,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
