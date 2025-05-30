import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';

import { getMyOrder } from '../../../api/api';
import { format } from 'date-fns';
import { useAuth } from '../../../providers/auth-provider';

const OrderDetails = () => {
  const router = useRouter();
  const { user, mounting } = useAuth();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const { data: order, error, isLoading } = getMyOrder(slug);

  // Handle authentication loading state
  if (mounting) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Handle unauthenticated state
  if (!user) {
    Alert.alert(
      'Sign In Required',
      'Please sign in to view order details',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => router.back() },
        { text: 'Sign In', onPress: () => router.push('/signin') }
      ]
    );
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.messageText}>Please sign in to view order details</Text>
      </View>
    );
  }

  // Handle loading state
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Handle error state
  if (error || !order) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>
          {error?.message || 'Order not found'}
        </Text>
      </View>
    );
  }

  const orderItems = order.order_items.map((orderItem: any) => ({
    id: orderItem.id,
    title: orderItem.products.title,
    heroImage: orderItem.products.heroImage,
    price: orderItem.products.price,
    quantity: orderItem.quantity,
  }));

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: order.slug }} />

      <Text style={styles.item}>{order.slug}</Text>
      <Text style={styles.details}>{order.description}</Text>
      <View style={[styles.statusBadge, styles[`statusBadge_${order.status}`]]}>
        <Text style={styles.statusText}>{order.status.toUpperCase()}</Text>
      </View>
      <Text style={styles.date}>
        {format(new Date(order.created_at), 'MMM dd, yyyy')}
      </Text>
      
      {orderItems.length > 0 ? (
        <>
          <Text style={styles.itemsTitle}>Items Ordered:</Text>
          <FlatList
            data={orderItems}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.orderItem}>
                <Image source={{ uri: item.heroImage }} style={styles.heroImage} />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.title}</Text>
                  <Text style={styles.itemPrice}>Price: ${item.price}</Text>
                  <Text style={styles.itemQuantity}>Quantity: {item.quantity}</Text>
                </View>
              </View>
            )}
          />
        </>
      ) : (
        <Text style={styles.messageText}>No items found in this order</Text>
      )}
    </View>
  );
};

export default OrderDetails;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  messageText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#ff0000',
    textAlign: 'center',
  },
  item: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  details: {
    fontSize: 16,
    marginBottom: 16,
  },
  statusBadge: {
    padding: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusBadge_Pending: {
    backgroundColor: '#ffcc00',
  },
  statusBadge_Completed: {
    backgroundColor: '#4caf50',
  },
  statusBadge_Shipped: {
    backgroundColor: '#2196f3',
  },
  statusBadge_InTransit: {
    backgroundColor: '#ff9800',
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  date: {
    fontSize: 14,
    color: '#555',
    marginTop: 16,
  },
  itemsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  orderItem: {
    flexDirection: 'row',
    marginTop: 8,
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  heroImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 16,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemPrice: {
    fontSize: 14,
    marginTop: 4,
    color: '#666',
  },
  itemQuantity: {
    fontSize: 14,
    marginTop: 4,
    color: '#666',
  },
});
