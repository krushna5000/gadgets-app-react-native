import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/auth-provider';
import { generateOrderSlug } from '../utils/utils';

export const getProductsAndCategories = () => {
  return useQuery({
    queryKey: ['products', 'categories'],
    queryFn: async () => {
      const [products, categories] = await Promise.all([
        supabase.from('product').select('*'),
        supabase.from('category').select('*'),
      ]);

      if (products.error || categories.error) {
        throw new Error('An error occurred while fetching data');
      }

      return { products: products.data, categories: categories.data };
    },
  });
};

export const getProduct = (slug: string) => {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error || !data) {
        throw new Error(
          'An error occurred while fetching data: ' + error?.message
        );
      }

      return data;
    },
  });
};

export const getCategoryAndProducts = (categorySlug: string) => {
  return useQuery({
    queryKey: ['categoryAndProducts', categorySlug],
    queryFn: async () => {
      if (!categorySlug) {
        throw new Error('Category slug is required');
      }

      // First get the category
      const { data: category, error: categoryError } = await supabase
        .from('category')
        .select('*')
        .eq('slug', categorySlug)
        .single();

      if (categoryError) {
        if (categoryError.code === 'PGRST116') {
          throw new Error('Category not found');
        }
        throw new Error(`Error fetching category: ${categoryError.message}`);
      }

      if (!category) {
        throw new Error('Category not found');
      }

      // Then get the products for this category
      const { data: products, error: productsError } = await supabase
        .from('product')
        .select('*')
        .eq('category', category.id)
        .order('created_at', { ascending: false });

      if (productsError) {
        throw new Error(`Error fetching products: ${productsError.message}`);
      }

      return {
        category,
        products: products || [],
      };
    },
    enabled: !!categorySlug,
  });
};

export const getMyOrders = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['orders', user?.id],
    queryFn: async () => {
      if (!user || !user.id) {
        throw new Error('User must be authenticated to view orders');
      }

      const { data, error } = await supabase
        .from('order')
        .select('*')
        .order('created_at', { ascending: false })
        .eq('user', user.id);

      if (error)
        throw new Error(
          'An error occurred while fetching orders: ' + error.message
        );

      return data || [];
    },
    enabled: !!user?.id,
  });
};

export const createOrder = () => {
  const { user } = useAuth();

  const slug = generateOrderSlug();
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn({ totalPrice }: { totalPrice: number }) {
      if (!user || !user.id) {
        throw new Error('User must be authenticated to create an order');
      }

      const { data, error } = await supabase
        .from('order')
        .insert({
          totalPrice,
          slug,
          user: user.id,
          status: 'Pending',
        })
        .select('*')
        .single();

      if (error) {
        throw new Error(
          'An error occurred while creating order: ' + error.message
        );
      }

      if (!data) {
        throw new Error('No data returned from order creation');
      }

      return data;
    },

    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: ['order'] });
    },
  });
};

export const createOrderItem = () => {
  return useMutation({
    async mutationFn(
      insertData: {
        orderId: number;
        productId: number;
        quantity: number;
      }[]
    ) {
      const { data, error } = await supabase
        .from('order_item')
        .insert(
          insertData.map(({ orderId, quantity, productId }) => ({
            order: orderId,
            product: productId,
            quantity,
          }))
        )
        .select('*');

      const productQuantities = insertData.reduce(
        (acc, { productId, quantity }) => {
          if (!acc[productId]) {
            acc[productId] = 0;
          }
          acc[productId] += quantity;
          return acc;
        },
        {} as Record<number, number>
      );

      await Promise.all(
        Object.entries(productQuantities).map(
          async ([productId, totalQuantity]) =>
            supabase.rpc('decrement_product_quantity', {
              product_id: Number(productId),
              quantity: totalQuantity,
            })
        )
      );

      if (error)
        throw new Error(
          'An error occurred while creating order item: ' + error.message
        );

      return data;
    },
  });
};

export const getMyOrder = (slug: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['orders', slug, user?.id],
    queryFn: async () => {
      if (!user || !user.id) {
        throw new Error('User must be authenticated to view order details');
      }

      const { data, error } = await supabase
        .from('order')
        .select('*, order_items:order_item(*, products:product(*))')
        .eq('slug', slug)
        .eq('user', user.id)
        .single();

      if (error || !data)
        throw new Error(
          'An error occurred while fetching data: ' + error?.message || 'Order not found'
        );

      return data;
    },
    enabled: !!user?.id,
  });
};
